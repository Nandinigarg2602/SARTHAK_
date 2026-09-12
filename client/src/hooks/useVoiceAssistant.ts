import { useState, useEffect, useRef, useCallback } from 'react';
import { voiceAPI } from '../services/api';

export type VoiceLanguage = 'hi' | 'en' | 'kn';

interface UseVoiceAssistantOptions {
  language?: string;
  patientName?: string;
  onDistressDetected?: (phrase: string) => void;
  onSafeConfirmed?: () => void;
  nextMedicationText?: string;
}

interface UseVoiceAssistantReturn {
  isListening: boolean;
  transcript: string;
  lastResponse: string;
  isSupported: boolean;
  listeningLanguage: VoiceLanguage;
  setListeningLanguage: (lang: VoiceLanguage) => void;
  toggleListening: () => void;
  startListening: () => void;
  stopListening: () => void;
  speakText: (text: string, langCode?: string) => void;
}

// Comprehensive Hindi, Hinglish, English, and Regional Distress Regex (Filtered with word boundaries)
export const DISTRESS_REGEX = /(बचाओ|मदद करो|मदद चाहिए|मदद की जरूरत|मुझे बचाओ|बचा लो|चक्कर आ रहे|तबीयत खराब|बहुत बीमार|गंभीर तकलीफ|छाती में दर्द|सांस नहीं आ रही|उठ नहीं पा रहा|उठ नहीं पा रही|गिर गया|गिर गई|गिर पड़ा|डॉक्टर को बुलाओ|एम्बुलेंस बुलाओ|कॉल करो|फोन करो|चोट लग गई|चोट लगी|खून बह रहा|घबराहट हो रही|बेहोश हो रहा|कष्ट में हूँ|हेल्प करो|हैल्प करो|मददगार बुलाओ|हालत बहुत खराब|गंभीर हालत|\bbachao\b|\bmadad\b|\bmadad karo\b|\bsahayata\b|\bdard ho raha\b|\bchakkar\b|\btabiyat kharab\b|\bbeemar\b|\btakleef\b|\bchhati me dard\b|\bsaans nahi\b|\buth nahi\b|\butha nahi\b|\bgir gaya\b|\bgir gayi\b|\bgir pada\b|\bdoctor bulao\b|\bambulance bulao\b|\bcall karo\b|\bphone karo\b|\bchot lagi\b|\bghabrahat\b|\bhelp\b|\bhelp me\b|\bemergency\b|\bsave me\b|\bi fell\b|\bfell down\b|\bcannot get up\b|\bcant get up\b|\bchest pain\b|\bheart attack\b|\bstroke\b|\bambulance\b|\bsevere pain\b|\bcannot breathe\b|\bcant breathe\b|\bneed help\b|\bplease help\b|\byes help\b|\bcall help\b|\bsend help\b|\bcall caregiver\b|\bcall family\b|\bcall someone\b|\bcall emergency\b|\bcall ambulance\b|ಸಹಾಯ|ಕಾಪಾಡಿ|ಬಿದ್ದಿದ್ದೇನೆ|\bsahaya\b|\bkaapadi\b|\bbiddiddene\b)/i;

// Comprehensive Safe / Cancel Confirmation Regex
export const SAFE_REGEX = /(ठीक हूँ|ठीक हु|मैं ठीक हूँ|सब ठीक है|कोई बात नहीं|चिंता मत करो|चिंता न करो|मदद मिल गई|अलार्म बंद|सुरक्षित हूँ|सुरक्षित|theek hoon|thik hu|thik hai|theek hai|main theek|sab theek|chinta mat|madad mil|safe|i am ok|i am fine|all good|false alarm|cancel|dismiss|no problem|help arrived|help is here|got help|resolved|all clear|doctor is here|safe now|emergency resolved|ಸಹಾಯ ಸಿಕ್ಕಿತು)/i;

const DISTRESS_KEYWORDS = [
  'help', 'help me', 'emergency', 'i fell', 'fell down', 'cannot get up', "can't get up", 'call doctor',
  'call caregiver', 'call family', 'ambulance', 'save me', 'need help', 'please help', 'yes help',
  'send help', 'call someone', 'cannot breathe', "can't breathe", 'chest pain', 'severe pain',
  'बचाओ', 'मदद', 'मदद करो', 'गिर गया', 'गिर गई', 'उठ नहीं पा रहा', 'चक्कर आ रहे', 'दर्द हो रहा', 'डॉक्टर को बुलाओ',
  'छाती में दर्द', 'सांस नहीं', 'चोट लगी', 'बचा लो', 'तबीयत खराब', 'मदद चाहिए',
  'bachao', 'madad', 'bachao bachao', 'madad karo', 'gir gaya', 'gir gayi', 'dard ho raha', 'chhati me dard', 'chot lagi',
  'ಸಹಾಯ', 'ಕಾಪಾಡಿ', 'ಬಿದ್ದಿದ್ದೇನೆ', 'sahaya', 'kaapadi'
];

const SAFE_KEYWORDS = [
  'i am ok', 'i am okay', 'i am fine', "i'm ok", 'false alarm', 'cancel', 'no problem', 'all good', 'safe',
  'help arrived', 'resolved', 'all clear', 'safe now', 'emergency resolved',
  'मैं ठीक हूँ', 'कोई बात नहीं', 'ठीक हूँ', 'theek hoon', 'thik hu', 'thik hai', 'main theek hoon', 'chinta mat karo',
  'मदद मिल गई', 'सब ठीक हो गया', 'theek ho gaya', 'madad mil gayi', 'ಸಹಾಯ ಸಿಕ್ಕಿತು'
];

export function useVoiceAssistant({
  language = 'hi',
  patientName = 'Senior',
  onDistressDetected,
  onSafeConfirmed,
  nextMedicationText = 'No medications scheduled currently.',
}: UseVoiceAssistantOptions = {}): UseVoiceAssistantReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [lastResponse, setLastResponse] = useState('');

  // Default listening language to Hindi ('hi') or stored preference
  const [listeningLanguage, setListeningLanguageState] = useState<VoiceLanguage>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sarthak_voice_lang') : null;
    if (saved === 'hi' || saved === 'en' || saved === 'kn') return saved as VoiceLanguage;
    return (language === 'hi' || language === 'kn') ? (language as VoiceLanguage) : 'hi';
  });

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const isSystemSpeakingRef = useRef<boolean>(false);
  const systemSpokenPhrasesRef = useRef<string[]>([]);
  const lastDistressTime = useRef<number>(0);
  const lastProcessedTextRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const interimDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const callbacksRef = useRef({ onDistressDetected, onSafeConfirmed, nextMedicationText, patientName });
  const isSupported = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep latest callbacks in ref without triggering re-initialization
  useEffect(() => {
    callbacksRef.current = { onDistressDetected, onSafeConfirmed, nextMedicationText, patientName };
  }, [onDistressDetected, onSafeConfirmed, nextMedicationText, patientName]);

  // Sync listening language with props or custom language event
  useEffect(() => {
    if (language && (language === 'hi' || language === 'en' || language === 'kn')) {
      setListeningLanguageState(language as VoiceLanguage);
    }
  }, [language]);

  useEffect(() => {
    const handleLangSync = (e?: any) => {
      const newLang = e?.detail || localStorage.getItem('sarthak_voice_lang') || localStorage.getItem('sarthak_language');
      if (newLang === 'hi' || newLang === 'en' || newLang === 'kn') {
        setListeningLanguageState(newLang as VoiceLanguage);
      }
    };
    window.addEventListener('sarthak_lang_changed', handleLangSync);
    window.addEventListener('storage', handleLangSync);
    return () => {
      window.removeEventListener('sarthak_lang_changed', handleLangSync);
      window.removeEventListener('storage', handleLangSync);
    };
  }, []);

  const setListeningLanguage = useCallback((newLang: VoiceLanguage) => {
    setListeningLanguageState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sarthak_voice_lang', newLang);
    }
  }, []);

  const speakText = useCallback((text: string, langCode?: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Register spoken prompt to prevent speech recognition from self-hearing and looping
      isSystemSpeakingRef.current = true;
      (window as any).__sarthak_is_speaking = true;
      const lower = text.toLowerCase();
      systemSpokenPhrasesRef.current = [lower, ...systemSpokenPhrasesRef.current.slice(0, 4)];

      utterance.onend = () => {
        setTimeout(() => {
          isSystemSpeakingRef.current = false;
          (window as any).__sarthak_is_speaking = false;
        }, 800);
      };
      utterance.onerror = () => {
        isSystemSpeakingRef.current = false;
        (window as any).__sarthak_is_speaking = false;
      };

      const hasHindi = /[\u0900-\u097F]/.test(text);
      const hasKannada = /[\u0C80-\u0CFF]/.test(text);

      const targetLang = langCode || (
        hasHindi
          ? 'hi-IN'
          : hasKannada
          ? 'kn-IN'
          : listeningLanguage === 'hi'
          ? 'hi-IN'
          : listeningLanguage === 'kn'
          ? 'kn-IN'
          : 'en-IN'
      );
      utterance.lang = targetLang;

      // Select best matching regional speech voice if available in browser
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const prefix = targetLang.substring(0, 2).toLowerCase();
        const matched = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
        if (matched) {
          utterance.voice = matched;
        }
      }

      window.speechSynthesis.speak(utterance);
      setLastResponse(text);
    } catch (e) {
      console.warn('[VOICE] Speech synthesis error:', e);
      isSystemSpeakingRef.current = false;
      (window as any).__sarthak_is_speaking = false;
      setLastResponse(text);
    }
  }, [listeningLanguage]);

  const processPhrase = useCallback(async (rawPhrase: string, isInstantEmergency: boolean = false) => {
    const text = rawPhrase.trim().toLowerCase();
    if (!text) return;

    // 0. Echo suppression: ONLY ignore if assistant is actively speaking and the heard phrase matches the assistant's own prompt
    const isEchoOfSystem = /(noticed a sudden movement|calling designated caregiver|calling caregiver|emergency distress recognized|आपातकालीन सहायता सुनी गई|कॉल की जा रही है)/i.test(text);
    if (isSystemSpeakingRef.current && isEchoOfSystem) {
      console.log('[VOICE] Echo of system prompt ignored to prevent glitching loop:', text);
      return;
    }

    // Prevent re-processing identical phrase within 2.5 seconds
    const now = Date.now();
    if (text === lastProcessedTextRef.current && (now - lastProcessedTimeRef.current < 2500)) {
      return;
    }
    lastProcessedTextRef.current = text;
    lastProcessedTimeRef.current = now;
    setTranscript(rawPhrase);

    // 1. Check if phrase is a negated safe statement (e.g., "I am not okay", "theek nahi hoon", "not safe") -> That is DISTRESS!
    const isNegatedSafe = /(not ok|not okay|not fine|not safe|theek nahi|thik nahi|nahi theek|nahi thik|nahi hu theek|ठीक नहीं|नहीं ठीक|सुरक्षित नहीं|मदद चाहिए)/i.test(text);

    // 2. Instant check for high-priority distress screams (Devanagari, Hinglish, English, or Kannada)
    const hasDistress = isNegatedSafe || DISTRESS_REGEX.test(rawPhrase) || DISTRESS_REGEX.test(text) || DISTRESS_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
    if (hasDistress) {
      if (now - lastDistressTime.current > 3000) {
        lastDistressTime.current = now;
        const isHi = /[\u0900-\u097F]/.test(rawPhrase) || /bachao|madad|dard|chakkar|gir|tabiyat|chhati|saans|ghabrahat|doctor|bimar|takleef/i.test(text) || listeningLanguage === 'hi';
        const isKn = /[\u0C80-\u0CFF]/.test(rawPhrase) || /sahaya|kaapadi/i.test(text) || listeningLanguage === 'kn';

        const resp = isHi
          ? 'आपातकालीन सहायता सुनी गई। आपके परिवार और डॉक्टर को तुरंत कॉल की जा रही है। आप बिल्कुल शांत रहें।'
          : isKn
          ? 'ತುರ್ತು ಸಹಾಯ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ. ಕುಟುಂಬ ಮತ್ತು ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ.'
          : 'Emergency distress recognized. Calling designated caregiver immediately. Please remain calm.';

        speakText(resp, isHi ? 'hi-IN' : isKn ? 'kn-IN' : 'en-IN');
        callbacksRef.current.onDistressDetected?.(rawPhrase);
      }
      return;
    }

    // 2. Instant check for safe confirmation ("i am ok", "theek hoon", "false alarm")
    const isQuestionPrompt = /(are you okay|are you ok|kya aap theek|kya aap thik|क्या आप ठीक|क्या आप thik)/i.test(text);
    const hasSafe = !isNegatedSafe && !isQuestionPrompt && (SAFE_REGEX.test(rawPhrase) || SAFE_REGEX.test(text) || SAFE_KEYWORDS.some((kw) => text.includes(kw.toLowerCase())));
    if (hasSafe) {
      const isHi = /[\u0900-\u097F]/.test(rawPhrase) || /theek|thik|chinta|madad|surakshit/i.test(text) || listeningLanguage === 'hi';
      const isKn = /[\u0C80-\u0CFF]/.test(rawPhrase) || listeningLanguage === 'kn';

      const resp = isHi
        ? 'अलार्म रद्द कर दिया गया है। मुझे बहुत खुशी है कि आप बिल्कुल सुरक्षित हैं।'
        : isKn
        ? 'ಎಚ್ಚರಿಕೆ ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ. ನೀವು ಸುರಕ್ಷಿತವಾಗಿರುವುದು ಸಂತೋಷ ತಂದಿದೆ.'
        : 'Alert cancelled. Glad to hear you are safe and sound.';

      speakText(resp, isHi ? 'hi-IN' : isKn ? 'kn-IN' : 'en-IN');
      callbacksRef.current.onSafeConfirmed?.();
      return;
    }

    if (isInstantEmergency) return;

    // 3. Fast direct check for common queries to guarantee instant, 100% valid Hindi replies
    // Time Query
    if (/(समय|टाइम|कितने बजे|घड़ी|घड़ी|time|clock|samay|kitne baje)/i.test(text)) {
      const timeStr = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
      const isHi = /[\u0900-\u097F]/.test(rawPhrase) || /samay|baje|time/i.test(text) || listeningLanguage === 'hi';
      const resp = isHi ? `वर्तमान समय ${timeStr} है।` : `The current time is ${timeStr}.`;
      speakText(resp, isHi ? 'hi-IN' : 'en-IN');
      return;
    }

    // Medication Query
    if (/(दवाई|दवा|गोली|खुराक|औषध|medicine|pill|tablet|dawai|goli|khuraak)/i.test(text)) {
      const medText = callbacksRef.current.nextMedicationText || 'फिलहाल कोई दवाई निर्धारित नहीं है।';
      const isHi = /[\u0900-\u097F]/.test(rawPhrase) || /dawai|goli|khuraak/i.test(text) || listeningLanguage === 'hi';
      const resp = isHi ? `आपकी अगली खुराक: ${medText}। समय पर दवाई अवश्य लें।` : `Your next scheduled dose: ${medText}. Remember to take it on time.`;
      speakText(resp, isHi ? 'hi-IN' : 'en-IN');
      return;
    }

    // Friendly Greetings & Companion Check-ins
    if (/(नमस्ते|नमस्कार|प्रणाम|कैसे हो|क्या हाल|आप कौन हो|तुम कौन हो|सार्थक|namaste|namaskar|kaise ho|kya haal|who are you|hello|hi)/i.test(text)) {
      const isHi = /[\u0900-\u097F]/.test(rawPhrase) || /namaste|kaise|sarthak/i.test(text) || listeningLanguage === 'hi';
      const resp = isHi
        ? `नमस्ते जी! मैं सार्थक हूँ, आपका व्यक्तिगत स्वास्थ्य और सुरक्षा साथी। मैं आपकी क्या सहायता कर सकता हूँ?`
        : `Hello! I am Sarthak, your personal health and telecare companion. How may I assist you today?`;
      speakText(resp, isHi ? 'hi-IN' : 'en-IN');
      return;
    }

    // 4. Intelligent Multilingual Companion & Natural Language Processing (calls backend NLP + Gemini AI)
    try {
      const timeStr = new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
      const res = await voiceAPI.process({
        text: rawPhrase,
        patientName: callbacksRef.current.patientName,
        nextMedication: callbacksRef.current.nextMedicationText,
        currentTime: timeStr,
        currentLanguage: listeningLanguage,
      });

      const data = res.data?.data;
      if (!data || !data.reply) return;

      // Speak response in natural regional accent
      speakText(data.reply, data.detectedLanguageCode);

      // Handle intent
      if (data.intent === 'DISTRESS') {
        const distNow = Date.now();
        if (distNow - lastDistressTime.current > 4000) {
          lastDistressTime.current = distNow;
          callbacksRef.current.onDistressDetected?.(rawPhrase);
        }
      } else if (data.intent === 'SAFE') {
        callbacksRef.current.onSafeConfirmed?.();
      }
    } catch (err) {
      console.warn('[VOICE] Multilingual voice API error, using quick fallback:', err);
      const isHi = /[\u0900-\u097F]/.test(rawPhrase) || listeningLanguage === 'hi';
      const fallbackResp = isHi
        ? `जी, मैंने सुना: "${rawPhrase}"। मैं आपकी सुरक्षा और देखभाल के लिए हमेशा यहाँ हूँ।`
        : `I heard: "${rawPhrase}". I am right here to keep you safe and assist you.`;
      speakText(fallbackResp, isHi ? 'hi-IN' : 'en-IN');
    }
  }, [listeningLanguage, speakText]);

  const stopListening = useCallback(() => {
    isPausedRef.current = true;
    isListeningRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (interimDebounceRef.current) {
      clearTimeout(interimDebounceRef.current);
      interimDebounceRef.current = null;
    }
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      recognitionRef.current = null;
      rec.onresult = null;
      rec.onend = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      console.warn('[VOICE] Speech recognition not supported in this browser.');
      setIsListening(false);
      isListeningRef.current = false;
      return;
    }

    // If recognition is already actively running, preserve it without disruption
    if (recognitionRef.current && isListeningRef.current) {
      isPausedRef.current = false;
      setIsListening(true);
      return;
    }

    isPausedRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    // Clean up any stale instance
    if (recognitionRef.current) {
      const prev = recognitionRef.current;
      recognitionRef.current = null;
      prev.onresult = null;
      prev.onend = null;
      prev.onerror = null;
      try {
        prev.abort();
      } catch {}
    }

    // Unlock microphone permissions in browser
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.warn('[VOICE] Browser microphone permission check:', err);
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      // Listening Language: 'hi-IN' for Hindi, 'kn-IN' for Kannada, 'en-IN' for English
      recognition.lang = listeningLanguage === 'hi' ? 'hi-IN' : listeningLanguage === 'kn' ? 'kn-IN' : 'en-IN';

      recognition.onstart = () => {
        isListeningRef.current = true;
        setIsListening(true);
        console.log('[VOICE] Microphone listening started');
      };

      recognition.onresult = (event: any) => {
        if (isPausedRef.current) return;
        let finalPhrase = '';
        let interimPhrase = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          const text = res[0]?.transcript || '';
          if (res.isFinal) {
            finalPhrase += text;
          } else {
            interimPhrase += text;
          }
        }

        const displayPhrase = (finalPhrase || interimPhrase).trim();
        if (displayPhrase) {
          setTranscript(displayPhrase);
        }

        // Check interim text for urgent emergency distress keywords to trigger 0ms latency
        if (interimPhrase) {
          const lowerInterim = interimPhrase.toLowerCase();
          const isSystemPrompt = /(noticed a sudden movement|are you okay|क्या आप ठीक|अचानक हरकत|emergency distress recognized|calling designated caregiver|calling caregiver|आपातकालीन सहायता सुनी गई|कॉल की जा रही है)/i.test(lowerInterim);

          if (!isSystemSpeakingRef.current || !isSystemPrompt) {
            const isNegated = /(not ok|not okay|not fine|theek nahi|thik nahi|nahi theek|ठीक नहीं)/i.test(lowerInterim);
            const hasInstant = isNegated || DISTRESS_REGEX.test(interimPhrase) || DISTRESS_REGEX.test(lowerInterim) || DISTRESS_KEYWORDS.some((kw) => lowerInterim.includes(kw.toLowerCase()));
            if (hasInstant) {
              processPhrase(interimPhrase, true);
              return;
            }
          }

          // Debounce interim conversational speech if user pauses speaking
          if (interimDebounceRef.current) {
            clearTimeout(interimDebounceRef.current);
          }
          interimDebounceRef.current = setTimeout(() => {
            if (!isPausedRef.current && interimPhrase.trim().length > 3) {
              processPhrase(interimPhrase.trim());
            }
          }, 1200);
        }

        // Process final speech output with natural AI
        if (finalPhrase.trim()) {
          if (interimDebounceRef.current) {
            clearTimeout(interimDebounceRef.current);
            interimDebounceRef.current = null;
          }
          processPhrase(finalPhrase.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('[VOICE] Speech error:', err?.error);
        if (err?.error === 'not-allowed' || err?.error === 'service-not-allowed') {
          isListeningRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        isListeningRef.current = false;
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null;
        }

        // If user paused, do NOT auto-restart
        if (isPausedRef.current) {
          setIsListening(false);
          return;
        }

        // Re-instantiate continuous recognition after brief silence timeout
        restartTimeoutRef.current = setTimeout(() => {
          if (!isPausedRef.current) {
            startListening();
          }
        }, 300);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      isListeningRef.current = true;
    } catch (err) {
      console.error('[VOICE] Failed to start recognition:', err);
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, listeningLanguage, processPhrase]);

  const toggleListening = useCallback(() => {
    if (isListeningRef.current || isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Restart recognition automatically when listeningLanguage switches
  useEffect(() => {
    if (!isPausedRef.current) {
      startListening();
    }
    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (recognitionRef.current) {
        const rec = recognitionRef.current;
        recognitionRef.current = null;
        rec.onresult = null;
        rec.onend = null;
        rec.onerror = null;
        try {
          rec.abort();
        } catch {}
      }
    };
  }, [listeningLanguage, startListening]);

  return {
    isListening,
    transcript,
    lastResponse,
    isSupported,
    listeningLanguage,
    setListeningLanguage,
    toggleListening,
    startListening,
    stopListening,
    speakText,
  };
}
