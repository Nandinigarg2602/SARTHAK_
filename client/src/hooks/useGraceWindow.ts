import { useState, useCallback, useRef, useEffect } from 'react';

type GraceResult = 'SAFE' | 'DISTRESS' | 'TIMEOUT' | 'PENDING';

interface UseGraceWindowOptions {
  durationSeconds: number;
  language: string;
  safeKeywords: string[];
  distressKeywords: string[];
  disableBuiltInRecognition?: boolean;
}

interface UseGraceWindowReturn {
  isActive: boolean;
  result: GraceResult;
  secondsRemaining: number;
  startGraceWindow: () => void;
  cancelGraceWindow: () => void;
  stopGraceWindow: () => void;
  manualResponse: (response: 'safe' | 'distress') => void;
}

const SAFE_KEYWORDS_EN = ["i'm okay", "im okay", "i am okay", "i am fine", "i'm fine", "fine", "okay", "all good", "no problem", "safe", "ok"];
const SAFE_KEYWORDS_HI = ['ठीक हूँ', 'ठीक हूं', 'ठीक है', 'कोई बात नहीं', 'सब ठीक', 'theek hoon', 'thik hai'];
const DISTRESS_KEYWORDS_EN = ['help', 'help me', 'help help', 'i fell', 'call someone', 'emergency', 'bachao', 'madad'];
const DISTRESS_KEYWORDS_HI = ['मदद', 'बचाओ', 'गिर गया', 'गिर गई', 'दर्द', 'हेल्प', 'हैल्प', 'हैलप'];

export function useGraceWindow(
  options: Partial<UseGraceWindowOptions> = {},
  onResult?: (result: GraceResult) => void
): UseGraceWindowReturn {
  const {
    durationSeconds = 15,
    language = 'hi-IN',
  } = options;

  const allSafeKeywords = [...SAFE_KEYWORDS_EN, ...SAFE_KEYWORDS_HI, ...(options.safeKeywords || [])];
  const allDistressKeywords = [...DISTRESS_KEYWORDS_EN, ...DISTRESS_KEYWORDS_HI, ...(options.distressKeywords || [])];

  const [isActive, setIsActive] = useState(false);
  const [result, setResult] = useState<GraceResult>('PENDING');
  const [secondsRemaining, setSecondsRemaining] = useState(durationSeconds);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const resolveGrace = useCallback(
    (outcome: GraceResult) => {
      cleanup();
      setResult(outcome);
      setIsActive(false);
      onResult?.(outcome);
    },
    [cleanup, onResult]
  );

  const startGraceWindow = useCallback(() => {
    setIsActive(true);
    setResult('PENDING');
    setSecondsRemaining(durationSeconds);

    // Play audio prompt
    const promptText =
      language.startsWith('hi')
        ? 'मुझे अचानक हरकत दिखी। क्या आप ठीक हैं?'
        : 'I noticed a sudden movement. Are you okay?';

    try {
      const utterance = new SpeechSynthesisUtterance(promptText);
      utterance.lang = language;
      utterance.rate = 0.9;
      utterance.volume = 1;
      (window as any).__sarthak_is_speaking = true;
      (window as any).__sarthak_last_system_prompt = promptText.toLowerCase();
      utterance.onend = () => {
        setTimeout(() => {
          (window as any).__sarthak_is_speaking = false;
        }, 800);
      };
      utterance.onerror = () => {
        (window as any).__sarthak_is_speaking = false;
      };
      speechSynthesis.speak(utterance);
    } catch {
      console.warn('[GRACE] Speech synthesis not available');
      (window as any).__sarthak_is_speaking = false;
    }

    // Start countdown
    let remaining = durationSeconds;
    countdownRef.current = setInterval(() => {
      remaining--;
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        resolveGrace('TIMEOUT');
      }
    }, 1000);

    // Start speech recognition only if not handled by dedicated voice assistant
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!options.disableBuiltInRecognition && SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = language;
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join(' ')
          .toLowerCase()
          .trim();

        console.log('[GRACE] Heard:', transcript);

        // Check for distress keywords first (higher priority)
        if (allDistressKeywords.some((k) => transcript.includes(k))) {
          resolveGrace('DISTRESS');
          return;
        }

        // Check for safe keywords
        if (allSafeKeywords.some((k) => transcript.includes(k))) {
          resolveGrace('SAFE');
          return;
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[GRACE] Speech recognition error:', event.error);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
      } catch (err) {
        console.warn('[GRACE] Speech recognition already running in voice companion:', err);
      }
    } else {
      console.warn('[GRACE] Speech recognition not supported — relying on manual input');
    }

    // Timeout fallback
    timerRef.current = setTimeout(() => {
      resolveGrace('TIMEOUT');
    }, durationSeconds * 1000 + 500);
  }, [durationSeconds, language, allSafeKeywords, allDistressKeywords, resolveGrace]);

  const cancelGraceWindow = useCallback(() => {
    resolveGrace('SAFE');
  }, [resolveGrace]);

  const stopGraceWindow = useCallback(() => {
    cleanup();
    setIsActive(false);
    setResult('PENDING');
  }, [cleanup]);

  const manualResponse = useCallback(
    (response: 'safe' | 'distress') => {
      resolveGrace(response === 'safe' ? 'SAFE' : 'DISTRESS');
    },
    [resolveGrace]
  );

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isActive,
    result,
    secondsRemaining,
    startGraceWindow,
    cancelGraceWindow,
    stopGraceWindow,
    manualResponse,
  };
}
