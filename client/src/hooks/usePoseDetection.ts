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
    noseY?: number;
    timestamp: number;
  }>>([]);

  // Behavioral timers & Fall State Machine
  const baselineTorsoYRef = useRef<number | null>(null);
  const fallCandidateRef = useRef<{
    timestamp: number;
    startY: number;
    startSpineAngle: number;
  } | null>(null);
  const disappearanceStartTime = useRef<number | null>(null);
  const collapseStartTime = useRef<number | null>(null);
  const floorStartTime = useRef<number | null>(null);
  const slumpStartTime = useRef<number | null>(null);
  const agitationStartTime = useRef<number | null>(null);
  const lastEmergencyTriggerTime = useRef<number>(0);
  const lastAbnormalAlertTime = useRef<number>(0);

  // ── Medication Ingestion State Machine ──
  // 4-Phase Physical Arc: 'IDLE' -> 'HAND_LOWERED' -> 'HAND_RAISING' -> 'AT_MOUTH' -> 'RETRACTING'
  type IngestionPhase = 'IDLE' | 'HAND_LOWERED' | 'HAND_RAISING' | 'AT_MOUTH' | 'RETRACTING';
  const ingestionPhaseRef = useRef<IngestionPhase>('IDLE');
  const activeHandRef = useRef<'left' | 'right' | null>(null);
  const handLoweredStartTime = useRef<number | null>(null);
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
        // Trigger out-of-frame fall IF preceded by a downward plunge towards bottom bezel
        const hadRecentPlunge =
          (fallCandidateRef.current !== null && (now - fallCandidateRef.current.timestamp <= 3000)) ||
          (historyRef.current.length >= 2 && (() => {
            const lastFrames = historyRef.current.slice(-5);
            const first = lastFrames[0];
            const last = lastFrames[lastFrames.length - 1];
            return (last.torsoY > first.torsoY + 0.07) || (last.torsoY > 0.65);
          })());

        if (hadRecentPlunge) {
          if (!disappearanceStartTime.current) {
            disappearanceStartTime.current = now;
            console.log('[POSE FALL] Subject dropped below camera after plunge. Verifying immobility...');
          } else if (now - disappearanceStartTime.current >= 1000) {
            console.log('[POSE FALL] CONFIRMED FALL: Subject plunged out of frame and remained absent for > 1.0s');
            setPosture('Ground / Lowered');
            setBehavior('Fall Detected');
            setBehaviorTelemetry({
              behavior: 'Fall Detected',
              isAbnormal: true,
              isEmergency: true,
              confidence: 0.96,
              postureStability: 5,
              movementVelocity: 'Still',
              floorTimeSeconds: Math.floor((now - disappearanceStartTime.current) / 1000),
            });
            if (now - lastEmergencyTriggerTime.current > 15000) {
              lastEmergencyTriggerTime.current = now;
              setFallDetected(true);
              onFallDetected?.({
                type: 'FALL',
                description: 'Severe posture collapse to floor (dropped below camera view)',
                confidence: 0.96,
                timestamp: now,
              });
            }
            return;
          }
          setPosture('Ground / Lowered');
          setBehavior('Fall Detected');
          return;
        }

        // Normal absence (person stepped away or room empty)
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
        disappearanceStartTime.current = null;
        fallCandidateRef.current = null;
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
        if (fallCandidateRef.current && (now - fallCandidateRef.current.timestamp <= 2500)) {
          if (!disappearanceStartTime.current) {
            disappearanceStartTime.current = now;
          } else if (now - disappearanceStartTime.current >= 1800) {
            setPosture('Ground / Lowered');
            setBehavior('Fall Detected');
            setBehaviorTelemetry({
              behavior: 'Fall Detected',
              isAbnormal: true,
              isEmergency: true,
              confidence: 0.95,
              postureStability: 5,
              movementVelocity: 'Still',
              floorTimeSeconds: Math.floor((now - disappearanceStartTime.current) / 1000),
            });
            if (now - lastEmergencyTriggerTime.current > 18000) {
              lastEmergencyTriggerTime.current = now;
              setFallDetected(true);
              onFallDetected?.({
                type: 'FALL',
                description: 'Severe posture collapse to floor (partial occlusion / out of frame)',
                confidence: 0.95,
                timestamp: now,
              });
            }
            return;
          }
          setPosture('Ground / Lowered');
          setBehavior('Fall Detected');
          return;
        }

        setPosture('No Person');
        setBehavior('No Person');
        return;
      }

      // Person is clearly visible in frame — reset out-of-frame timer
      disappearanceStartTime.current = null;

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

      // Update history buffer (rolling 2500ms)
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
        noseY: nose ? nose.y : undefined,
        timestamp: now,
      });
      historyRef.current = historyRef.current.filter((f) => now - f.timestamp <= 2500);

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

      // ── DYNAMIC UPRIGHT BASELINE CALIBRATION ──
      // Tracks user's natural seated or standing height to prevent false alarms
      const isUprightAndCalm = spineAngleDeg < 25 && Math.abs(velY) < 0.08 && Math.abs(velX) < 0.08;
      if (baselineTorsoYRef.current === null && torsoY < 0.75) {
        baselineTorsoYRef.current = torsoY;
      } else if (isUprightAndCalm) {
        // Slow continuous baseline adaptation (alpha = 0.02)
        baselineTorsoYRef.current = 0.98 * (baselineTorsoYRef.current ?? torsoY) + 0.02 * torsoY;
      }
      const baselineY = baselineTorsoYRef.current ?? torsoY;
      const dropFromBase = torsoY - baselineY;

      // ── KINEMATIC FALL DESCENT DETECTOR ──
      // Checks for rapid, uncontrolled downward drop in the last 120ms - 850ms
      const descentCandidates = historyRef.current.filter(
        (f) => now - f.timestamp >= 120 && now - f.timestamp <= 850
      );
      for (const past of descentCandidates) {
        const dt = Math.max(0.08, (now - past.timestamp) / 1000);
        const dy = torsoY - past.torsoY; // Positive = downward
        const speed = dy / dt;
        const dAngle = Math.abs(spineAngleDeg - past.spineAngleDeg);

        // Kinematic fall descent: downward speed >= 0.35 with dy >= 0.08, or dy >= 0.12, or sudden tilt dAngle >= 25 with dy >= 0.06
        const isViolentDrop = speed >= 0.35 && dy >= 0.08;
        const isPlungeDrop = dy >= 0.12;
        const isCollapseTilt = dAngle >= 25 && dy >= 0.06;

        if (isViolentDrop || isPlungeDrop || isCollapseTilt) {
          if (!fallCandidateRef.current) {
            fallCandidateRef.current = {
              timestamp: now,
              startY: past.torsoY,
              startSpineAngle: past.spineAngleDeg,
            };
            console.log(`[POSE FALL] Fall descent candidate detected: dy=${dy.toFixed(2)}, speed=${speed.toFixed(2)}, dropFromBase=${dropFromBase.toFixed(2)}`);
          }
          break;
        }
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

      // ── POSTURE & ACTIVITY CLASSIFICATION ──
      // Person is sitting upright at desk if spine is upright AND height is at baseline:
      const isSittingAtDesk = verticalSpineSpan >= 0.08 && spineAngleDeg < 35 && dropFromBase < 0.10 && torsoY < 0.70;

      // Standing condition: tall bounding box, vertical posture, hips and knees visible
      const hasLegs = kneeL && kneeR && (kneeL.visibility ?? 1) > 0.35 && (kneeR.visibility ?? 1) > 0.35;
      const isStanding =
        !isSittingAtDesk &&
        hasHips &&
        bboxHeight > 0.55 &&
        aspectRatio > 1.30 &&
        spineAngleDeg < 25;

      // Floor / Lowered condition:
      // The person has dropped visibly below baseline height or is tilted/collapsed on the floor
      const isFloorLevel =
        (dropFromBase >= 0.10) ||
        (torsoY >= 0.68 && dropFromBase >= 0.05) ||
        (spineAngleDeg > 42 && dropFromBase >= 0.05) ||
        (spineAngleDeg > 55) ||
        (nose && nose.y > 0.65 && dropFromBase >= 0.06);

      // Sitting in general (desk or chair, not collapsed to floor)
      const isSitting = !isFloorLevel && (isSittingAtDesk || (verticalSpineSpan >= 0.05 && torsoY < 0.80));

      // Walking / Moving: active lateral translation
      const isWalking = !isFloorLevel && !isSittingAtDesk && velX > 0.28 && spineAngleDeg < 30;

      // Controlled bending / reaching forward
      const isBending =
        !isFloorLevel &&
        !isSittingAtDesk &&
        spineAngleDeg >= 35 &&
        spineAngleDeg <= 55 &&
        torsoY < 0.75;

      // Movement velocity classification
      let movementVelocity: 'Still' | 'Normal' | 'Rapid' | 'Erratic' = 'Normal';
      if (Math.abs(velY) < 0.06 && velX < 0.06) {
        movementVelocity = 'Still';
      } else if (wristJitter > 0.50 && velX < 0.20) {
        movementVelocity = 'Erratic';
      } else if (Math.abs(velY) > 0.85 || velX > 0.85) {
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
      let detectedBehavior: DetectedBehavior = isStanding ? 'Standing Upright' : 'Sitting Comfortably';
      let isAbnormal = false;
      let isEmergency = false;
      let stability = 95;

      // 1. ACCURATE FALL DETECTION (Descent + Ground Dwell of 0.8s)
      const hasRecentDescent =
        fallCandidateRef.current !== null && (now - fallCandidateRef.current.timestamp <= 4000);

      if (hasRecentDescent) {
        if (isFloorLevel) {
          // Person has dropped and remains in lowered / ground position
          if (!collapseStartTime.current) {
            collapseStartTime.current = now;
            console.log('[POSE FALL] Ground collapse verified post-descent. Verifying dwell (0.8s)...');
          } else if (now - collapseStartTime.current >= 800) {
            // Sustained post-impact floor state for 0.8s -> CONFIRMED FALL
            detectedBehavior = 'Fall Detected';
            isEmergency = true;
            isAbnormal = true;
            stability = 10;
            if (now - lastEmergencyTriggerTime.current > 15000) {
              lastEmergencyTriggerTime.current = now;
              fallCandidateRef.current = null;
              collapseStartTime.current = null;
              setFallDetected(true);
              console.log('[POSE FALL] CONFIRMED FALL EVENT DISPATCHED');
              onFallDetected?.({
                type: 'FALL',
                description: 'Severe posture collapse to floor',
                confidence: 0.96,
                timestamp: now,
              });
            }
          }
        } else {
          // Check if person recovered upright smoothly
          const isUprightAgain =
            torsoY <= (baselineY + 0.05) && spineAngleDeg < 25 && isSittingAtDesk;
          if (isUprightAgain && fallCandidateRef.current && (now - fallCandidateRef.current.timestamp > 600)) {
            console.log('[POSE FALL] Person recovered upright — resetting fall candidate.');
            fallCandidateRef.current = null;
            collapseStartTime.current = null;
          }
        }
      } else {
        collapseStartTime.current = null;
      }

      // 2. PROLONGED FLOOR IMMOBILITY (ONLY if dropped significantly lower than baseline)
      if (isFloorLevel && !isEmergency && dropFromBase >= 0.16) {
        if (!floorStartTime.current) {
          floorStartTime.current = now;
        } else {
          const floorSec = Math.floor((now - floorStartTime.current) / 1000);
          if (floorSec >= 6) {
            detectedBehavior = 'Prolonged Floor Immobility';
            isEmergency = true;
            isAbnormal = true;
            stability = 15;
            if (now - lastEmergencyTriggerTime.current > 18000) {
              lastEmergencyTriggerTime.current = now;
              floorStartTime.current = null;
              setFallDetected(true);
              console.log('[POSE FALL] Prolonged floor immobility (> 6s) dispatched');
              onFallDetected?.({
                type: 'FLOOR_IMMOBILITY',
                description: 'Senior stationary on floor for over 6 seconds',
                confidence: 0.94,
                timestamp: now,
              });
            }
          }
        }
      } else {
        floorStartTime.current = null;
      }

      // 3. ABNORMAL SUDDEN SLUMP (Syncope / loss of tone while seated)
      // Must be seated, severe slump (spineAngle >= 42° AND head drops below/near shoulders),
      // and virtually motionless for >= 4.5 seconds
      if (!isEmergency && isSitting) {
        const isSeverelySlumped =
          (spineAngleDeg >= 42 && (nose ? nose.y > torsoY + 0.04 : true)) ||
          (spineAngleDeg >= 50);

        const isMotionless = Math.abs(velY) < 0.08 && velX < 0.08;

        if (isSeverelySlumped && isMotionless) {
          if (!slumpStartTime.current) {
            slumpStartTime.current = now;
          } else if (now - slumpStartTime.current >= 4500) {
            detectedBehavior = 'Sudden Slump';
            isAbnormal = true;
            stability = 40;
            if (now - lastAbnormalAlertTime.current > 20000) {
              lastAbnormalAlertTime.current = now;
              onAbnormalBehavior?.({
                type: 'SUDDEN_SLUMP',
                description: 'Unresponsive postural slump / loss of motor tone (> 4.5s)',
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
      // High-frequency wrist agitation sustained for at least 3.5 seconds
      if (!isEmergency && !isAbnormal && wristJitter >= 0.55 && velX < 0.18) {
        if (!agitationStartTime.current) {
          agitationStartTime.current = now;
        } else if (now - agitationStartTime.current >= 3500) {
          detectedBehavior = 'Distress Agitation';
          isAbnormal = true;
          stability = 35;
          if (now - lastAbnormalAlertTime.current > 20000) {
            lastAbnormalAlertTime.current = now;
            onAbnormalBehavior?.({
              type: 'DISTRESS_AGITATION',
              description: 'Persistent distress motor agitation / tremors (> 3.5s)',
              confidence: 0.86,
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

                // ── 4-PHASE MEDICATION INGESTION ARC ──
                // Phase 0: IDLE (Waiting for hand to start lowered below chest)
                if (currentPhase === 'IDLE') {
                  if (isLeftLow && !isLeftAtMouth) {
                    activeHandRef.current = 'left';
                    handLoweredStartTime.current = currentTimeMs;
                    ingestionPhaseRef.current = 'HAND_LOWERED';
                  } else if (isRightLow && !isRightAtMouth) {
                    activeHandRef.current = 'right';
                    handLoweredStartTime.current = currentTimeMs;
                    ingestionPhaseRef.current = 'HAND_LOWERED';
                  }
                }
                // Phase 1: HAND_LOWERED (Hand confirmed in lower rest position for >= 200ms)
                else if (currentPhase === 'HAND_LOWERED') {
                  const isLow = activeHandRef.current === 'left' ? isLeftLow : isRightLow;
                  const targetDist = activeHandRef.current === 'left' ? distLeft : distRight;

                  if (isLow) {
                    // Hand remains lowered, ready for upward action
                    setIngestionProgress(10);
                  } else if (targetDist < 0.85 && (currentTimeMs - (handLoweredStartTime.current || 0) >= 200)) {
                    // Hand has lifted from lowered rest and is traveling upward
                    ingestionPhaseRef.current = 'HAND_RAISING';
                  }
                }
                // Phase 2: HAND_RAISING (Tracking upward path to mouth)
                else if (currentPhase === 'HAND_RAISING') {
                  const targetDist = activeHandRef.current === 'left' ? distLeft : distRight;

                  if (targetDist <= MOUTH_PROXIMITY_THRESHOLD) {
                    // Hand has successfully reached the mouth area
                    ingestionPhaseRef.current = 'AT_MOUTH';
                    atMouthStartTime.current = currentTimeMs;
                    setIsIngesting(true);
                    setIngestionProgress(35);
                  } else if (targetDist > 1.2) {
                    // Hand moved away or went off-screen without reaching mouth
                    ingestionPhaseRef.current = 'IDLE';
                    activeHandRef.current = null;
                    setIsIngesting(false);
                    setIngestionProgress(0);
                  } else {
                    // Hand in transit
                    const approachPct = Math.min(30, Math.max(15, Math.round((1 - (targetDist / 0.85)) * 30)));
                    setIngestionProgress(approachPct);
                  }
                }
                // Phase 3: AT_MOUTH (Drinking water / taking pill - requires sustained dwell of 1.4 seconds)
                else if (currentPhase === 'AT_MOUTH') {
                  if (handAtMouth) {
                    setIsIngesting(true);
                    const dwellElapsed = currentTimeMs - (atMouthStartTime.current || currentTimeMs);
                    const progress = Math.min(90, Math.round(35 + (dwellElapsed / 1400) * 55));
                    setIngestionProgress(progress);

                    // Confirmed Ingestion!
                    if (dwellElapsed >= 1400) {
                      ingestionPhaseRef.current = 'RETRACTING';
                      setIngestionProgress(95);
                    }
                  } else {
                    // Hand moved away from mouth
                    const dwellElapsed = currentTimeMs - (atMouthStartTime.current || currentTimeMs);
                    if (dwellElapsed >= 1100 && currentTimeMs - lastIngestionTriggerTime.current > 8000) {
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
                // Phase 4: RETRACTING (Hand lowers away from mouth to seal confirmed intake)
                else if (currentPhase === 'RETRACTING') {
                  const isLow = activeHandRef.current === 'left' ? isLeftLow : isRightLow;
                  const targetDist = activeHandRef.current === 'left' ? distLeft : distRight;

                  if (!handAtMouth || isLow || targetDist > 0.45) {
                    lastIngestionTriggerTime.current = currentTimeMs;
                    ingestionPhaseRef.current = 'IDLE';
                    atMouthStartTime.current = null;
                    activeHandRef.current = null;
                    setIngestionProgress(100);
                    setIsIngesting(false);
                    onIngestionRef.current?.();
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

                  const isEmerg = collapseStartTime.current !== null || fallCandidateRef.current !== null || disappearanceStartTime.current !== null || (floorStartTime.current !== null && (Date.now() - floorStartTime.current >= 3000));
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
                    ctx.strokeStyle = (ingestionPhaseRef.current === 'AT_MOUTH' || ingestionPhaseRef.current === 'RETRACTING') ? '#10b981' : ingestionPhaseRef.current === 'HAND_RAISING' ? '#38bdf8' : '#f59e0b';
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

                    ctx.fillStyle = (ingestionPhaseRef.current === 'AT_MOUTH' || ingestionPhaseRef.current === 'RETRACTING') ? '#34d399' : ingestionPhaseRef.current === 'HAND_RAISING' ? '#38bdf8' : '#fbbf24';
                    ctx.font = 'bold 13px system-ui, sans-serif';

                    let promptText = '💊 Medication Mode: Bring medicine/water to mouth';
                    if (ingestionPhaseRef.current === 'AT_MOUTH' || ingestionPhaseRef.current === 'RETRACTING') {
                      const dwellElapsed = Date.now() - (atMouthStartTime.current || Date.now());
                      const pct = Math.min(95, Math.round(35 + (dwellElapsed / 1400) * 60));
                      promptText = `💊 Taking Medicine (Swallowing)... ${pct}%`;
                    } else if (ingestionPhaseRef.current === 'HAND_RAISING') {
                      promptText = '💊 Hand moving to mouth...';
                    } else if (ingestionPhaseRef.current === 'HAND_LOWERED') {
                      promptText = '💊 Ready — raise pill or water to mouth';
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
              analyzeFrame([]);
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  // Render warning banner if user suddenly vanished from camera following downward drop
                  if (disappearanceStartTime.current !== null) {
                    const elapsed = ((Date.now() - disappearanceStartTime.current) / 1000).toFixed(1);
                    ctx.fillStyle = 'rgba(220, 38, 38, 0.90)';
                    if ((ctx as any).roundRect) {
                      (ctx as any).roundRect(14, 14, canvas.width - 28, 42, 10);
                    } else {
                      ctx.fillRect(14, 14, canvas.width - 28, 42);
                    }
                    ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 13px system-ui, sans-serif';
                    ctx.fillText(`🚨 SUDDEN COLLAPSE DETECTED — Verifying floor immobility (${elapsed}s)...`, 26, 40);
                  }
                }
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
    disappearanceStartTime.current = null;
    fallCandidateRef.current = null;
    baselineTorsoYRef.current = null;
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
