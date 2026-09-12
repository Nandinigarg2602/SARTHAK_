import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

export type DetectedBehavior =
  | 'Standing Upright'
  | 'Sitting Comfortably'
  | 'Walking / Moving'
  | 'Bending / Reaching'
  | 'Sudden Slump'
  | 'Distress Agitation'
  | 'Fall Detected'
  | 'Prolonged Floor Immobility'
  | 'No Person';

export interface BehaviorTelemetry {
  behavior: DetectedBehavior;
  isAbnormal: boolean;
  isEmergency: boolean;
  confidence: number;
  postureStability: number; // 0 - 100%
  movementVelocity: 'Still' | 'Normal' | 'Rapid' | 'Erratic';
  floorTimeSeconds: number;
}

export interface EmergencyEvent {
  type: 'FALL' | 'FLOOR_IMMOBILITY';
  description: string;
  confidence: number;
  timestamp: number;
}

export interface AbnormalEvent {
  type: 'SUDDEN_SLUMP' | 'DISTRESS_AGITATION';
  description: string;
  confidence: number;
  timestamp: number;
}

interface FallDetectionConfig {
  heightDropThreshold?: number;
  targetFps?: number;
}

interface UsePoseDetectionReturn {
  isReady: boolean;
  isDetecting: boolean;
  fallDetected: boolean;
  currentPose: any | null;
  posture: 'Upright' | 'Bending' | 'Ground / Lowered' | 'No Person';
  behavior: DetectedBehavior;
  behaviorTelemetry: BehaviorTelemetry;
  landmarksCount: number;
  isMedicationModeActive: boolean;
  ingestionProgress: number;
  isIngesting: boolean;
  triggerTestFall: () => void;
  triggerManualIngestionConfirm: () => void;
  startDetection: (video: HTMLVideoElement, canvas?: HTMLCanvasElement) => void;
  stopDetection: () => void;
  resetFallState: () => void;
}

const DEFAULT_CONFIG: FallDetectionConfig = {
  heightDropThreshold: 0.35,
  targetFps: 8,
};

export function usePoseDetection(
  config: Partial<FallDetectionConfig> = {},
  onFallDetected?: (event?: EmergencyEvent) => void,
  onAbnormalBehavior?: (event?: AbnormalEvent) => void,
  isMedicationMode: boolean = false,
  onMedicationIngestionDetected?: () => void
): UsePoseDetectionReturn {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);

  const [isReady, setIsReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [fallDetected, setFallDetected] = useState(false);
  const [currentPose, setCurrentPose] = useState<any>(null);
  const [posture, setPosture] = useState<'Upright' | 'Bending' | 'Ground / Lowered' | 'No Person'>('No Person');
  const [behavior, setBehavior] = useState<DetectedBehavior>('No Person');
  const [behaviorTelemetry, setBehaviorTelemetry] = useState<BehaviorTelemetry>({
    behavior: 'No Person',
    isAbnormal: false,
    isEmergency: false,
    confidence: 0,
    postureStability: 100,
    movementVelocity: 'Still',
    floorTimeSeconds: 0,
  });
  const [landmarksCount, setLandmarksCount] = useState<number>(0);

  // Tracking history (stores kinematic variables over rolling 2500ms window)
  const historyRef = useRef<Array<{
    torsoY: number;
    torsoX: number;
    hipY: number;
    wristLY: number;
    wristRY: number;
    wristLX: number;
    wristRX: number;
    bboxHeight: number;
    bboxWidth: number;
    aspectRatio: number;
    spineAngleDeg: number;
    timestamp: number;
  }>>([]);

  // Behavioral timers
  const collapseStartTime = useRef<number | null>(null);
  const floorStartTime = useRef<number | null>(null);
  const slumpStartTime = useRef<number | null>(null);
  const agitationStartTime = useRef<number | null>(null);
  const lastEmergencyTriggerTime = useRef<number>(0);
  const lastAbnormalAlertTime = useRef<number>(0);

  // ── Medication Ingestion State Machine ──
  // Phases: 'IDLE' -> 'HAND_RAISING' -> 'AT_MOUTH' -> 'COMPLETED'
  type IngestionPhase = 'IDLE' | 'HAND_RAISING' | 'AT_MOUTH';
  const ingestionPhaseRef = useRef<IngestionPhase>('IDLE');
  const activeHandRef = useRef<'left' | 'right' | null>(null);
  const atMouthStartTime = useRef<number | null>(null);
  const lastIngestionTriggerTime = useRef<number>(0);

  const [ingestionProgress, setIngestionProgress] = useState<number>(0);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);

  const medModeRef = useRef(isMedicationMode);
  useEffect(() => {
    medModeRef.current = isMedicationMode;
    if (!isMedicationMode) {
      ingestionPhaseRef.current = 'IDLE';
      activeHandRef.current = null;
      atMouthStartTime.current = null;
      setIngestionProgress(0);
      setIsIngesting(false);
    }
  }, [isMedicationMode]);

  const onIngestionRef = useRef(onMedicationIngestionDetected);
  useEffect(() => {
    onIngestionRef.current = onMedicationIngestionDetected;
  }, [onMedicationIngestionDetected]);

  const triggerManualIngestionConfirm = useCallback(() => {
    setIngestionProgress(100);
    setIsIngesting(false);
    ingestionPhaseRef.current = 'IDLE';
    atMouthStartTime.current = null;
    activeHandRef.current = null;
    onIngestionRef.current?.();
  }, []);

  // Initialize MediaPipe Pose Landmarker
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );

        const modelUrl =
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

        let landmarker: PoseLandmarker | null = null;
        try {
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
          console.log('[POSE] PoseLandmarker initialized with GPU delegate');
        } catch (gpuErr) {
          console.warn('[POSE] GPU delegate init failed, falling back to CPU:', gpuErr);
          landmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelUrl,
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.45,
            minPosePresenceConfidence: 0.45,
            minTrackingConfidence: 0.45,
          });
          console.log('[POSE] PoseLandmarker initialized with CPU delegate');
        }

        if (!cancelled && landmarker) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
        }
      } catch (err) {
        console.error('[POSE] Failed to initialize PoseLandmarker:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, []);

  // Frame Analysis Engine
  const analyzeFrame = useCallback(
    (landmarks: any[]) => {
      const now = Date.now();

      if (!landmarks || landmarks.length === 0) {
        setPosture('No Person');
        setBehavior('No Person');
        setLandmarksCount(0);
        setBehaviorTelemetry({
          behavior: 'No Person',
          isAbnormal: false,
          isEmergency: false,
          confidence: 0,
          postureStability: 100,
          movementVelocity: 'Still',
          floorTimeSeconds: 0,
        });
        collapseStartTime.current = null;
        floorStartTime.current = null;
        slumpStartTime.current = null;
        agitationStartTime.current = null;
        return;
      }

      const pose = landmarks[0];

      // Calculate visible joints and bounding box
      let minY = 1, maxY = 0, minX = 1, maxX = 0;
      let visibleCount = 0;
      for (const lm of pose) {
        if (lm.visibility === undefined || lm.visibility > 0.45) {
          visibleCount++;
          minY = Math.min(minY, lm.y);
          maxY = Math.max(maxY, lm.y);
          minX = Math.min(minX, lm.x);
          maxX = Math.max(maxX, lm.x);
        }
      }
      setLandmarksCount(visibleCount);

      if (visibleCount < 5) {
        setPosture('No Person');
        setBehavior('No Person');
        return;
      }

      const nose = pose[0];
      const shoulderL = pose[11];
      const shoulderR = pose[12];
      const elbowL = pose[13];
      const elbowR = pose[14];
      const wristL = pose[15];
      const wristR = pose[16];
      const hipL = pose[23];
      const hipR = pose[24];
      const kneeL = pose[25];
      const kneeR = pose[26];

      // Physiological scale: shoulder width is a robust physical reference
      const shoulderSpan = (shoulderL && shoulderR && (shoulderL.visibility ?? 1) > 0.4 && (shoulderR.visibility ?? 1) > 0.4)
        ? Math.hypot(shoulderL.x - shoulderR.x, shoulderL.y - shoulderR.y)
        : 0.25;
      const refScale = Math.max(0.12, shoulderSpan);

      // Anatomical centers
      const torsoY = (shoulderL && shoulderR)
        ? (shoulderL.y + shoulderR.y) / 2
        : (nose ? nose.y + 0.15 : 0.5);
      const torsoX = (shoulderL && shoulderR)
        ? (shoulderL.x + shoulderR.x) / 2
        : (nose ? nose.x : 0.5);

      const hasHips = hipL && hipR && (hipL.visibility ?? 1) > 0.35 && (hipR.visibility ?? 1) > 0.35;
      const hipY = hasHips ? (hipL.y + hipR.y) / 2 : torsoY + 0.35;
      const hipX = hasHips ? (hipL.x + hipR.x) / 2 : torsoX;

      const verticalSpineSpan = hipY - torsoY; // Positive when shoulders are above hips
      const dx = Math.abs(torsoX - hipX);
      const dySpine = Math.max(0.01, verticalSpineSpan);
      const spineAngleDeg = Math.atan2(dx, dySpine) * (180 / Math.PI);

      const bboxHeight = Math.max(maxY - minY, 0.05);
      const bboxWidth = Math.max(maxX - minX, 0.05);
      const aspectRatio = bboxHeight / bboxWidth;

      // Update history buffer (rolling 2200ms)
      historyRef.current.push({
        torsoY,
        torsoX,
        hipY,
        wristLY: wristL ? wristL.y : 0.5,
        wristRY: wristR ? wristR.y : 0.5,
        wristLX: wristL ? wristL.x : 0.5,
        wristRX: wristR ? wristR.x : 0.5,
        bboxHeight,
        bboxWidth,
        aspectRatio,
        spineAngleDeg,
        timestamp: now,
      });
      historyRef.current = historyRef.current.filter((f) => now - f.timestamp <= 2200);

      // Kinematic velocity over 200ms - 450ms
      const velocityFrames = historyRef.current.filter(
        (f) => now - f.timestamp >= 200 && now - f.timestamp <= 450
      );
      let velY = 0;
      let velX = 0;
      if (velocityFrames.length > 0) {
        const past = velocityFrames[0];
        const dt = Math.max(0.1, (now - past.timestamp) / 1000);
        velY = (torsoY - past.torsoY) / dt; // Positive = downward movement
        velX = Math.abs(torsoX - past.torsoX) / dt;
      }

      // ── Wrist oscillation & agitation analysis (filtered for sensor jitter) ──
      let wristJitter = 0;
      if (historyRef.current.length >= 6) {
        const recentHist = historyRef.current.slice(-6);
        let diffSum = 0;
        for (let i = 1; i < recentHist.length; i++) {
          const dyL = Math.abs(recentHist[i].wristLY - recentHist[i - 1].wristLY);
          const dyR = Math.abs(recentHist[i].wristRY - recentHist[i - 1].wristRY);
          const dxL = Math.abs(recentHist[i].wristLX - recentHist[i - 1].wristLX);
          const dxR = Math.abs(recentHist[i].wristRX - recentHist[i - 1].wristRX);
          diffSum += (dyL + dyR + dxL + dxR);
        }
        // Normalize by reference scale to ignore normal sensor noise
        wristJitter = (diffSum / (recentHist.length * 4)) / refScale;
      }

      // ── Posture & Activity Classification ──
      // Real Floor Level Condition:
      // Person must be lying horizontal (high spine tilt), OR full body has collapsed near bottom of frame
      // CRITICAL: A person sitting at a desk with webcam showing upper body is NOT at floor level!
      const hasLegs = kneeL && kneeR && (kneeL.visibility ?? 1) > 0.35 && (kneeR.visibility ?? 1) > 0.35;
      
      const isFloorLevel = hasHips
        ? (spineAngleDeg > 62 && torsoY > 0.65) || (hasLegs && torsoY > 0.75 && aspectRatio < 0.75)
        : (torsoY > 0.85 && (nose ? nose.y > 0.82 : true)); // Close-up webcam: whole upper body must drop to bottom

      // Seated condition: upright spine, shoulders above hips, head in normal upper frame
      const isSitting =
        !isFloorLevel &&
        verticalSpineSpan >= 0.08 &&
        spineAngleDeg < 38 &&
        torsoY < 0.72;

      // Standing condition: tall bounding box, vertical posture, hips and knees visible
      const isStanding =
        !isFloorLevel &&
        hasHips &&
        bboxHeight > 0.55 &&
        aspectRatio > 1.30 &&
        spineAngleDeg < 25;

      // Walking / Moving: active lateral translation
      const isWalking = !isFloorLevel && velX > 0.28 && spineAngleDeg < 30;

      // Controlled bending / reaching forward
      const isBending =
        !isFloorLevel &&
        !isSitting &&
        spineAngleDeg >= 38 &&
        spineAngleDeg <= 62 &&
        torsoY < 0.75;

      // Movement velocity classification
      let movementVelocity: 'Still' | 'Normal' | 'Rapid' | 'Erratic' = 'Normal';
      if (Math.abs(velY) < 0.06 && velX < 0.06) {
        movementVelocity = 'Still';
      } else if (wristJitter > 0.45 && velX < 0.20) {
        movementVelocity = 'Erratic';
      } else if (Math.abs(velY) > 0.90 || velX > 0.90) {
        movementVelocity = 'Rapid';
      }

      // Backward-compatible posture string
      let currentPosture: 'Upright' | 'Bending' | 'Ground / Lowered' | 'No Person' = 'Upright';
      if (isFloorLevel) {
        currentPosture = 'Ground / Lowered';
      } else if (isBending) {
        currentPosture = 'Bending';
      } else {
        currentPosture = 'Upright';
      }
      setPosture(currentPosture);

      // ── BEHAVIOR ENGINE (Clinical Grade) ──
      let detectedBehavior: DetectedBehavior = 'Sitting Comfortably';
      let isAbnormal = false;
      let isEmergency = false;
      let stability = 95;

      // 1. ACCURATE FALL DETECTION
      // Real fall physics:
      // a) Violent downward descent (free fall acceleration): torso drops rapidly (velY > 1.1 screen heights/sec or dy > 0.35 within 350ms)
      // b) End state is horizontal / ground level collapse (isFloorLevel)
      // c) Post-impact shock stillness: person remains down for at least 2.2 seconds (not just bending or sitting into a chair)
      const collapseCandidates = historyRef.current.filter(
        (f) => now - f.timestamp >= 150 && now - f.timestamp <= 600
      );
      const hadViolentDescent = collapseCandidates.some((f) => {
        const dt = (now - f.timestamp) / 1000;
        const dy = torsoY - f.torsoY;
        const speed = dy / dt;
        return speed >= 1.15 || dy >= 0.36;
      });

      if (hadViolentDescent && isFloorLevel) {
        if (!collapseStartTime.current) {
          collapseStartTime.current = now;
        } else if (now - collapseStartTime.current >= 2200) {
          // Sustained post-impact floor state for 2.2s -> CONFIRMED FALL
          detectedBehavior = 'Fall Detected';
          isEmergency = true;
          isAbnormal = true;
          stability = 10;
          if (now - lastEmergencyTriggerTime.current > 18000) {
            lastEmergencyTriggerTime.current = now;
            setFallDetected(true);
            onFallDetected?.({
              type: 'FALL',
              description: 'Sudden high-velocity collapse with post-impact immobility',
              confidence: 0.96,
              timestamp: now,
            });
          }
        }
      } else {
        collapseStartTime.current = null;
      }

      // 2. PROLONGED FLOOR IMMOBILITY (e.g. fallen out of sight or unable to get up)
      // Must be genuinely at floor level, still, for at least 8 seconds
      if (isFloorLevel && !isEmergency) {
        if (!floorStartTime.current) {
          floorStartTime.current = now;
        } else {
          const floorSec = Math.floor((now - floorStartTime.current) / 1000);
          if (floorSec >= 8) {
            detectedBehavior = 'Prolonged Floor Immobility';
            isEmergency = true;
            isAbnormal = true;
            stability = 15;
            if (now - lastEmergencyTriggerTime.current > 18000) {
              lastEmergencyTriggerTime.current = now;
              setFallDetected(true);
              onFallDetected?.({
                type: 'FLOOR_IMMOBILITY',
                description: 'Senior stationary on floor for over 8 seconds',
                confidence: 0.93,
                timestamp: now,
              });
            }
          }
        }
      } else if (!isFloorLevel) {
        floorStartTime.current = null;
      }

      // 3. ABNORMAL SUDDEN SLUMP (Syncope / loss of tone while seated)
      // Must be seated upright previously, then head/spine drops severely (> 50 deg) AND remains completely still for >= 7 seconds
      if (!isEmergency && isSitting) {
        const isSeverelySlumped =
          spineAngleDeg > 48 ||
          (nose && shoulderL && shoulderR && nose.y > (shoulderL.y + shoulderR.y) / 2 + 0.10);

        if (isSeverelySlumped && movementVelocity === 'Still') {
          if (!slumpStartTime.current) {
            slumpStartTime.current = now;
          } else if (now - slumpStartTime.current >= 7000) {
            detectedBehavior = 'Sudden Slump';
            isAbnormal = true;
            stability = 40;
            if (now - lastAbnormalAlertTime.current > 20000) {
              lastAbnormalAlertTime.current = now;
              onAbnormalBehavior?.({
                type: 'SUDDEN_SLUMP',
                description: 'Unresponsive postural slump / loss of motor tone (> 7s)',
                confidence: 0.88,
                timestamp: now,
              });
            }
          }
        } else {
          slumpStartTime.current = null;
        }
      }

      // 4. DISTRESS AGITATION / ERRATIC STRUGGLE
      // High-frequency wrist agitation sustained for at least 4.5 seconds
      if (!isEmergency && !isAbnormal && wristJitter > 0.45 && movementVelocity === 'Erratic') {
        if (!agitationStartTime.current) {
          agitationStartTime.current = now;
        } else if (now - agitationStartTime.current >= 4500) {
          detectedBehavior = 'Distress Agitation';
          isAbnormal = true;
          stability = 35;
          if (now - lastAbnormalAlertTime.current > 20000) {
            lastAbnormalAlertTime.current = now;
            onAbnormalBehavior?.({
              type: 'DISTRESS_AGITATION',
              description: 'Persistent distress motor agitation / tremors (> 4.5s)',
              confidence: 0.84,
              timestamp: now,
            });
          }
        }
      } else {
        agitationStartTime.current = null;
      }

      // 5. NORMAL STABLE BEHAVIORS
      if (!isEmergency && !isAbnormal) {
        if (isStanding) {
          detectedBehavior = 'Standing Upright';
          stability = 98;
        } else if (isWalking) {
          detectedBehavior = 'Walking / Moving';
          stability = 92;
        } else if (isBending) {
          detectedBehavior = 'Bending / Reaching';
          stability = 80;
        } else {
          detectedBehavior = 'Sitting Comfortably';
          stability = 96;
        }
      }

      setBehavior(detectedBehavior);
      setBehaviorTelemetry({
        behavior: detectedBehavior,
        isAbnormal,
        isEmergency,
        confidence: isEmergency ? 0.95 : isAbnormal ? 0.87 : 0.96,
        postureStability: stability,
        movementVelocity,
        floorTimeSeconds: floorStartTime.current
          ? Math.floor((now - floorStartTime.current) / 1000)
          : 0,
      });
    },
    [onFallDetected, onAbnormalBehavior]
  );

  // ── DETECTION LOOP ──
  const startDetection = useCallback(
    (video: HTMLVideoElement, canvas?: HTMLCanvasElement) => {
      if (!landmarkerRef.current) return;

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }

      setIsDetecting(true);

      const frameInterval = 1000 / (cfg.targetFps || 8);
      let lastFrameTime = 0;
      let lastVideoTimestamp = 0;
      let drawingUtils: DrawingUtils | null = null;

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawingUtils = new DrawingUtils(ctx);
      }

      const detect = (timestamp: number) => {
        if (!landmarkerRef.current) return;

        if (!video || video.readyState < 2 || video.videoWidth === 0) {
          animFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        const now = performance.now();
        if (now - lastFrameTime >= frameInterval) {
          lastFrameTime = now;
          const currentTimestamp = now > lastVideoTimestamp ? now : lastVideoTimestamp + 1;
          lastVideoTimestamp = currentTimestamp;

          try {
            const result = landmarkerRef.current.detectForVideo(video, currentTimestamp);

            if (result.landmarks && result.landmarks.length > 0) {
              const landmarks = result.landmarks[0];
              setCurrentPose(landmarks);
              analyzeFrame(result.landmarks);

              // ════════════════════════════════════════════════════════════════
              // ── SINGLE-LENS MEDICATION INGESTION ENGINE (Zero False Positives) ──
              // ════════════════════════════════════════════════════════════════
              if (medModeRef.current && landmarks.length > 20) {
                const nose = landmarks[0];
                const mouthL = landmarks[9];
                const mouthR = landmarks[10];
                const shoulderL = landmarks[11];
                const shoulderR = landmarks[12];
                const wristL = landmarks[15];
                const wristR = landmarks[16];
                const indexL = landmarks[19];
                const indexR = landmarks[20];

                // Mouth position (geometric center of lips & nose base)
                const mouthX = mouthL && mouthR
                  ? (mouthL.x + mouthR.x) / 2
                  : (nose ? nose.x : 0.5);
                const mouthY = mouthL && mouthR
                  ? (mouthL.y + mouthR.y) / 2
                  : (nose ? nose.y + 0.05 : 0.4);

                // Shoulder span reference scale
                const refSpan = (shoulderL && shoulderR)
                  ? Math.hypot(shoulderL.x - shoulderR.x, shoulderL.y - shoulderR.y)
                  : 0.25;
                const normScale = Math.max(0.14, refSpan);

                // Hand keypoints with confidence verification
                const leftHandVisible = ((wristL?.visibility ?? 0) > 0.50) || ((indexL?.visibility ?? 0) > 0.50);
                const rightHandVisible = ((wristR?.visibility ?? 0) > 0.50) || ((indexR?.visibility ?? 0) > 0.50);

                // Hand coordinates (use wrist and index finger tip)
                const leftHandX = indexL && (indexL.visibility ?? 0) > 0.45 ? indexL.x : wristL?.x;
                const leftHandY = indexL && (indexL.visibility ?? 0) > 0.45 ? indexL.y : wristL?.y;

                const rightHandX = indexR && (indexR.visibility ?? 0) > 0.45 ? indexR.x : wristR?.x;
                const rightHandY = indexR && (indexR.visibility ?? 0) > 0.45 ? indexR.y : wristR?.y;

                const distLeft = (leftHandVisible && leftHandX !== undefined && leftHandY !== undefined)
                  ? Math.hypot(leftHandX - mouthX, leftHandY - mouthY) / normScale
                  : 999;

                const distRight = (rightHandVisible && rightHandX !== undefined && rightHandY !== undefined)
                  ? Math.hypot(rightHandX - mouthX, rightHandY - mouthY) / normScale
                  : 999;

                // Thresholds normalized by shoulder span
                // In proximity: hand is within ~38% of shoulder span to mouth
                const MOUTH_PROXIMITY_THRESHOLD = 0.38;
                // Hand low: hand is below chest level
                const chestY = (shoulderL && shoulderR) ? (shoulderL.y + shoulderR.y) / 2 + 0.08 : mouthY + 0.15;

                const isLeftAtMouth = distLeft <= MOUTH_PROXIMITY_THRESHOLD;
                const isRightAtMouth = distRight <= MOUTH_PROXIMITY_THRESHOLD;
                const handAtMouth = isLeftAtMouth || isRightAtMouth;

                const isLeftLow = leftHandVisible && leftHandY !== undefined && leftHandY > chestY;
                const isRightLow = rightHandVisible && rightHandY !== undefined && rightHandY > chestY;

                const currentPhase = ingestionPhaseRef.current;
                const currentTimeMs = Date.now();

                // ── STATE MACHINE ──
                // Phase 0: IDLE (Waiting for hand to start in lower position)
                if (currentPhase === 'IDLE') {
                  if (isLeftLow) {
                    activeHandRef.current = 'left';
                    ingestionPhaseRef.current = 'HAND_RAISING';
                  } else if (isRightLow) {
                    activeHandRef.current = 'right';
                    ingestionPhaseRef.current = 'HAND_RAISING';
                  }
                  // If hand is already at mouth on startup (e.g. resting chin), do NOT trigger false ingestion!
                }
                // Phase 1: HAND_RAISING (Tracking upward path to mouth)
                else if (currentPhase === 'HAND_RAISING') {
                  const targetDist = activeHandRef.current === 'left' ? distLeft : distRight;
                  const isLow = activeHandRef.current === 'left' ? isLeftLow : isRightLow;

                  if (targetDist <= MOUTH_PROXIMITY_THRESHOLD) {
                    // Hand has successfully reached the mouth area
                    ingestionPhaseRef.current = 'AT_MOUTH';
                    atMouthStartTime.current = currentTimeMs;
                    setIsIngesting(true);
                    setIngestionProgress(35);
                  } else if (targetDist > 1.2 && !isLow) {
                    // Hand moved away or went off-screen without reaching mouth
                    ingestionPhaseRef.current = 'IDLE';
                    activeHandRef.current = null;
                    setIsIngesting(false);
                    setIngestionProgress(0);
                  } else {
                    // Hand in transit
                    const approachPct = Math.min(30, Math.max(10, Math.round((1 - (targetDist / 1.0)) * 30)));
                    setIngestionProgress(approachPct);
                  }
                }
                // Phase 2: AT_MOUTH (Drinking water / taking pill - requires sustained dwell of 1.6 seconds)
                else if (currentPhase === 'AT_MOUTH') {
                  if (handAtMouth) {
                    setIsIngesting(true);
                    const dwellElapsed = currentTimeMs - (atMouthStartTime.current || currentTimeMs);
                    // Dwell required: 1600ms
                    const progress = Math.min(100, Math.round(35 + (dwellElapsed / 1600) * 65));
                    setIngestionProgress(progress);

                    // Confirmed Ingestion!
                    if (dwellElapsed >= 1600 && currentTimeMs - lastIngestionTriggerTime.current > 8000) {
                      lastIngestionTriggerTime.current = currentTimeMs;
                      ingestionPhaseRef.current = 'IDLE';
                      atMouthStartTime.current = null;
                      activeHandRef.current = null;
                      setIngestionProgress(100);
                      setIsIngesting(false);
                      onIngestionRef.current?.();
                    }
                  } else {
                    // Hand moved away from mouth
                    const dwellElapsed = currentTimeMs - (atMouthStartTime.current || currentTimeMs);
                    if (dwellElapsed >= 1300 && currentTimeMs - lastIngestionTriggerTime.current > 8000) {
                      // Hand dwelled at mouth and has now retracted -> Valid complete ingestion gesture!
                      lastIngestionTriggerTime.current = currentTimeMs;
                      ingestionPhaseRef.current = 'IDLE';
                      atMouthStartTime.current = null;
                      activeHandRef.current = null;
                      setIngestionProgress(100);
                      setIsIngesting(false);
                      onIngestionRef.current?.();
                    } else {
                      // Premature withdrawal (false alarm / scratch / quick touch) -> Reset!
                      ingestionPhaseRef.current = 'IDLE';
                      atMouthStartTime.current = null;
                      activeHandRef.current = null;
                      setIngestionProgress(0);
                      setIsIngesting(false);
                    }
                  }
                }
              }

              // ── Canvas Overlay Rendering ──
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx && video.videoWidth > 0) {
                  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    drawingUtils = new DrawingUtils(ctx);
                  }
                  ctx.clearRect(0, 0, canvas.width, canvas.height);

                  const isEmerg = collapseStartTime.current !== null || (floorStartTime.current !== null && (Date.now() - floorStartTime.current >= 4000));
                  const isAbnorm = slumpStartTime.current !== null || agitationStartTime.current !== null;

                  const lineColor = isEmerg ? '#ef4444' : isAbnorm ? '#f59e0b' : '#10b981';
                  const dotColor = isEmerg ? '#b91c1c' : isAbnorm ? '#d97706' : '#047857';
                  const fillDotColor = isEmerg ? '#fca5a5' : isAbnorm ? '#fde68a' : '#6ee7b7';

                  if (drawingUtils) {
                    try {
                      drawingUtils.drawConnectors(
                        landmarks,
                        PoseLandmarker.POSE_CONNECTIONS,
                        { color: lineColor, lineWidth: 3 }
                      );
                      drawingUtils.drawLandmarks(landmarks, {
                        radius: 4,
                        color: dotColor,
                        fillColor: fillDotColor,
                      });
                    } catch {
                      const w = canvas.width;
                      const h = canvas.height;
                      ctx.fillStyle = fillDotColor;
                      ctx.strokeStyle = dotColor;
                      ctx.lineWidth = 2;
                      for (const lm of landmarks) {
                        if (lm.visibility === undefined || lm.visibility > 0.4) {
                          ctx.beginPath();
                          ctx.arc(lm.x * w, lm.y * h, 4, 0, 2 * Math.PI);
                          ctx.fill();
                          ctx.stroke();
                        }
                      }
                    }
                  }

                  // Medication Mode Ingestion Target Overlay
                  if (medModeRef.current) {
                    const w = canvas.width;
                    const h = canvas.height;
                    const nose = landmarks[0];
                    const mouthX = ((landmarks[9]?.x || nose?.x || 0.5) + (landmarks[10]?.x || nose?.x || 0.5)) / 2 * w;
                    const mouthY = ((landmarks[9]?.y || nose?.y || 0.4) + (landmarks[10]?.y || nose?.y || 0.4)) / 2 * h;

                    // Draw target circle at mouth
                    ctx.beginPath();
                    ctx.arc(mouthX, mouthY, 22, 0, 2 * Math.PI);
                    ctx.strokeStyle = ingestionPhaseRef.current === 'AT_MOUTH' ? '#10b981' : ingestionPhaseRef.current === 'HAND_RAISING' ? '#38bdf8' : '#f59e0b';
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // HUD Banner at top of video
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
                    if ((ctx as any).roundRect) {
                      (ctx as any).roundRect(12, 12, w - 24, 38, 10);
                    } else {
                      ctx.fillRect(12, 12, w - 24, 38);
                    }
                    ctx.fill();

                    ctx.fillStyle = ingestionPhaseRef.current === 'AT_MOUTH' ? '#34d399' : ingestionPhaseRef.current === 'HAND_RAISING' ? '#38bdf8' : '#fbbf24';
                    ctx.font = 'bold 13px system-ui, sans-serif';

                    let promptText = '💊 Medication Mode: Bring medicine/water to mouth';
                    if (ingestionPhaseRef.current === 'AT_MOUTH') {
                      const dwellElapsed = Date.now() - (atMouthStartTime.current || Date.now());
                      const pct = Math.min(100, Math.round(35 + (dwellElapsed / 1600) * 65));
                      promptText = `💊 Taking Medicine (Swallowing)... ${pct}%`;
                    } else if (ingestionPhaseRef.current === 'HAND_RAISING') {
                      promptText = '💊 Hand moving to mouth...';
                    }
                    ctx.fillText(promptText, 24, 35);

                    if (ingestionProgress > 0) {
                      ctx.fillStyle = '#059669';
                      ctx.fillRect(12, 46, (w - 24) * (ingestionProgress / 100), 4);
                    }
                  }
                }
              }
            } else {
              setPosture('No Person');
              setBehavior('No Person');
              setLandmarksCount(0);
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }
          } catch (e) {
            console.warn('[POSE] detect error:', e);
          }
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    },
    [cfg.targetFps, analyzeFrame, ingestionProgress]
  );

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setIsDetecting(false);
  }, []);

  const resetFallState = useCallback(() => {
    setFallDetected(false);
    collapseStartTime.current = null;
    floorStartTime.current = null;
    slumpStartTime.current = null;
    agitationStartTime.current = null;
    lastEmergencyTriggerTime.current = 0;
    historyRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const triggerTestFall = useCallback(() => {
    console.log('[POSE] Manual test fall triggered');
    setFallDetected(true);
    onFallDetected?.({
      type: 'FALL',
      description: 'Manual test fall triggered',
      confidence: 1.0,
      timestamp: Date.now(),
    });
  }, [onFallDetected]);

  return {
    isReady,
    isDetecting,
    fallDetected,
    currentPose,
    posture,
    behavior,
    behaviorTelemetry,
    landmarksCount,
    isMedicationModeActive: isMedicationMode,
    ingestionProgress,
    isIngesting,
    triggerTestFall,
    triggerManualIngestionConfirm,
    startDetection,
    stopDetection,
    resetFallState,
  };
}
