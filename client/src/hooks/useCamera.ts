import { useEffect, useRef, useState, useCallback } from 'react';

interface UseCameraOptions {
  facingMode?: 'user' | 'environment';
  width?: number;
  height?: number;
  preferredDeviceId?: string;
}

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  error: string | null;
  videoDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  setSelectedDeviceId: (deviceId: string) => void;
  startCamera: (deviceIdOverride?: string) => Promise<void>;
  stopCamera: () => void;
  captureFrame: () => string | null;
  checkBrightness: () => number;
  attachVideo: (el: HTMLVideoElement | null) => void;
}

export function useCamera(options: UseCameraOptions = {}): UseCameraReturn {
  const { facingMode = 'user', width = 640, height = 480, preferredDeviceId } = options;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(preferredDeviceId || '');

  // Query and prioritize available video inputs (prefer laptop/built-in over phone/virtual)
  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');

      // Sort: Internal / Integrated / Laptop webcam first, phone/virtual last
      const isPhoneOrVirtual = (label: string) => {
        const l = label.toLowerCase();
        return l.includes('phone') || l.includes('droid') || l.includes('link to windows') || l.includes('continuity') || l.includes('virtual') || l.includes('obs');
      };

      const sorted = [...videoInputs].sort((a, b) => {
        const aPhone = isPhoneOrVirtual(a.label);
        const bPhone = isPhoneOrVirtual(b.label);
        if (aPhone && !bPhone) return 1;
        if (!aPhone && bPhone) return -1;
        return 0;
      });

      setVideoDevices(sorted);

      // Auto-select preferred device if not already chosen
      if (!selectedDeviceId && sorted.length > 0) {
        const preferred = sorted.find((d) => !isPhoneOrVirtual(d.label)) || sorted[0];
        setSelectedDeviceId(preferred.deviceId);
      }
    } catch (e) {
      console.warn('[CAMERA] Enumerate devices notice:', e);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const startCamera = useCallback(async (deviceIdOverride?: string) => {
    try {
      setError(null);
      const targetDeviceId = deviceIdOverride || selectedDeviceId;

      // Stop any existing stream tracks first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: width },
        height: { ideal: height },
        frameRate: { ideal: 15, max: 30 },
      };

      if (targetDeviceId) {
        videoConstraints.deviceId = { exact: targetDeviceId };
      } else {
        videoConstraints.facingMode = facingMode;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = mediaStream;
      setIsActive(true);

      // Refresh labels now that permission is granted
      refreshDevices();

      // Bind to video element if already in DOM
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        try {
          await videoRef.current.play();
        } catch (e) {
          console.warn('[CAMERA] Initial play() notice:', e);
        }
      }
    } catch (err: any) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : err.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${err.message}`;
      setError(message);
      setIsActive(false);
    }
  }, [facingMode, width, height, selectedDeviceId, refreshDevices]);

  // Ensure stream stays bound whenever video element mounts or becomes active
  useEffect(() => {
    if (isActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch((e) => console.warn('[CAMERA] Auto-play notice:', e));
    }
  }, [isActive]);

  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch((e) => console.warn('[CAMERA] attachVideo play notice:', e));
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  // Capture a single frame as base64 JPEG
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8).split(',')[1]; // base64 only
  }, [isActive]);

  // Check average brightness (0-255) for occlusion detection
  const checkBrightness = useCallback((): number => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isActive) return 0;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;

    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let sum = 0;
    // Sample every 20th pixel for performance
    for (let i = 0; i < data.length; i += 80) {
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    return sum / (data.length / 80);
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    stream: streamRef.current,
    isActive,
    error,
    videoDevices,
    selectedDeviceId,
    setSelectedDeviceId,
    startCamera,
    stopCamera,
    captureFrame,
    checkBrightness,
    attachVideo,
  };
}
