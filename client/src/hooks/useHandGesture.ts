import { useEffect, useRef, useState, useCallback } from 'react';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

interface UseHandGestureConfig {
  mouthProximityThreshold: number; // normalized distance threshold
  holdDurationMs: number;          // how long hand must be near mouth
  targetFps: number;
  clipDurationMs: number;          // video clip length to record
}

interface UseHandGestureReturn {
  isReady: boolean;
  isDetecting: boolean;
  gestureDetected: boolean;
  videoClipBlob: Blob | null;
  startDetection: (video: HTMLVideoElement) => void;
  stopDetection: () => void;
  resetGesture: () => void;
}

const DEFAULT_CONFIG: UseHandGestureConfig = {
  mouthProximityThreshold: 0.12,
  holdDurationMs: 1500,
  targetFps: 5,
  clipDurationMs: 3000,
};

export function useHandGesture(
  config: Partial<UseHandGestureConfig> = {},
  onGestureDetected?: (clip: Blob) => void
): UseHandGestureReturn {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [gestureDetected, setGestureDetected] = useState(false);
  const [videoClipBlob, setVideoClipBlob] = useState<Blob | null>(null);

  // Gesture tracking state
  const handNearMouthStart = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  // Initialize HandLandmarker
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 1,
        });

        if (!cancelled) {
          landmarkerRef.current = landmarker;
          setIsReady(true);
          console.log('[HAND] MediaPipe Hand Landmarker initialized');
        }
      } catch (err) {
        console.error('[HAND] Failed to initialize:', err);
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

  const startRecording = useCallback(
    (video: HTMLVideoElement) => {
      const stream = (video as any).captureStream?.(10) || (video.srcObject as MediaStream);
      if (!stream) return;

      recordedChunks.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        setVideoClipBlob(blob);
        setGestureDetected(true);
        onGestureDetected?.(blob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      // Stop after clip duration
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, cfg.clipDurationMs);
    },
    [cfg.clipDurationMs, onGestureDetected]
  );

  const startDetection = useCallback(
    (video: HTMLVideoElement) => {
      if (!landmarkerRef.current || isDetecting) return;
      setIsDetecting(true);

      const frameInterval = 1000 / cfg.targetFps;
      let lastFrameTime = 0;

      const detect = (timestamp: number) => {
        if (!landmarkerRef.current) return;

        if (timestamp - lastFrameTime >= frameInterval) {
          lastFrameTime = timestamp;

          try {
            const result = landmarkerRef.current.detectForVideo(
              video,
              performance.now()
            );

            if (result.landmarks && result.landmarks.length > 0) {
              const hand = result.landmarks[0];

              // Wrist landmark (index 0)
              const wrist = hand[0];
              // Index finger tip (index 8) — proxy for "holding something" position
              const fingerTip = hand[8];

              // Estimate mouth zone: upper portion of frame, centered
              // In normalized coords, mouth is approximately at y: 0.15-0.3, x: 0.35-0.65
              const mouthZone = { x: 0.5, y: 0.2 };

              // Calculate distance from wrist/fingertip to estimated mouth zone
              const wristToMouth = Math.sqrt(
                Math.pow(wrist.x - mouthZone.x, 2) +
                Math.pow(wrist.y - mouthZone.y, 2)
              );

              const fingerToMouth = Math.sqrt(
                Math.pow(fingerTip.x - mouthZone.x, 2) +
                Math.pow(fingerTip.y - mouthZone.y, 2)
              );

              const isNearMouth =
                wristToMouth < cfg.mouthProximityThreshold ||
                fingerToMouth < cfg.mouthProximityThreshold;

              if (isNearMouth) {
                if (!handNearMouthStart.current) {
                  handNearMouthStart.current = Date.now();
                } else if (
                  Date.now() - handNearMouthStart.current > cfg.holdDurationMs &&
                  !gestureDetected
                ) {
                  console.log('[HAND] 💊 Medication gesture detected — recording clip');
                  startRecording(video);
                  handNearMouthStart.current = null;
                }
              } else {
                handNearMouthStart.current = null;
              }
            }
          } catch {
            // Skip frame errors
          }
        }

        animFrameRef.current = requestAnimationFrame(detect);
      };

      animFrameRef.current = requestAnimationFrame(detect);
    },
    [isDetecting, cfg, gestureDetected, startRecording]
  );

  const stopDetection = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsDetecting(false);
  }, []);

  const resetGesture = useCallback(() => {
    setGestureDetected(false);
    setVideoClipBlob(null);
    handNearMouthStart.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  return {
    isReady,
    isDetecting,
    gestureDetected,
    videoClipBlob,
    startDetection,
    stopDetection,
    resetGesture,
  };
}
