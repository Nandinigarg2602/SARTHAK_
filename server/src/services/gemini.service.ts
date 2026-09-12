import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
const MODEL = 'gemini-3.6-flash';

// ──────────────────────────────────────
// Demo mode mock responses
// ──────────────────────────────────────
const MOCK_SCAN_RESULT = {
  medications: [
    {
      drugName: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      instructions: 'Take with meals',
    },
    {
      drugName: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Once daily',
      instructions: 'Take in the morning',
    },
  ],
};

const MOCK_INTERACTION_RESULT = {
  interactions: [
    {
      drug1: 'Metformin',
      drug2: 'Amlodipine',
      severity: 'Low',
      note: 'Generally safe. Monitor blood pressure and glucose regularly.',
    },
  ],
  overallRisk: 'Low',
};

const MOCK_ADHERENCE_RESULT = {
  isTakingMedication: true,
  confidence: 0.92,
  pillDescription: 'White round tablet',
};

// ──────────────────────────────────────
// Medication Scanning — Image → Structured JSON
// ──────────────────────────────────────
export async function scanMedication(imageBase64: string): Promise<any> {
  if (env.DEMO_MODE) {
    return MOCK_SCAN_RESULT;
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a medical image analysis assistant. Analyze this photo of a medicine strip or prescription.
Extract ALL medications visible and return a JSON object with this exact structure:
{
  "medications": [
    {
      "drugName": "exact medication name",
      "dosage": "dosage with unit (e.g., 500mg)",
      "frequency": "how often to take (e.g., Twice daily)",
      "instructions": "any special instructions visible"
    }
  ]
}
If you cannot identify a medication clearly, still include it with your best interpretation and add "(uncertain)" to the drugName.`,
          },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '{}';
  return JSON.parse(text);
}

// ──────────────────────────────────────
// Drug Interaction Checking
// ──────────────────────────────────────
export async function checkInteractions(
  medications: { drugName: string; dosage: string }[]
): Promise<any> {
  if (env.DEMO_MODE) {
    return MOCK_INTERACTION_RESULT;
  }

  const medList = medications
    .map((m) => `${m.drugName} ${m.dosage}`)
    .join(', ');

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a clinical pharmacology assistant. Analyze these medications for clinically established drug-drug interactions:

Medications: ${medList}

Return a JSON object with this structure:
{
  "interactions": [
    {
      "drug1": "first drug name",
      "drug2": "second drug name",
      "severity": "Low | Moderate | High | Severe",
      "note": "brief clinical explanation"
    }
  ],
  "overallRisk": "Low | Moderate | High | Severe"
}

Only include CLINICALLY ESTABLISHED interactions. If no interactions exist, return an empty interactions array with overallRisk "Low".`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '{}';
  return JSON.parse(text);
}

// ──────────────────────────────────────
// Medication Adherence Verification — Video Analysis
// ──────────────────────────────────────
export async function verifyAdherence(videoBase64: string): Promise<any> {
  if (env.DEMO_MODE) {
    return MOCK_ADHERENCE_RESULT;
  }

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a medication adherence verification system. Analyze this short video clip.
Determine if the user is holding and taking a pill or tablet.

Return a JSON object with this exact structure:
{
  "isTakingMedication": true/false,
  "confidence": 0.0-1.0,
  "pillDescription": "color, shape, and type description of the pill if visible"
}`,
          },
          {
            inlineData: {
              mimeType: 'video/webm',
              data: videoBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.text ?? '{}';
  return JSON.parse(text);
}

// ──────────────────────────────────────
// Emergency Context Synthesis
// ──────────────────────────────────────
export async function generateEmergencyContext(data: {
  patientName: string;
  age: number;
  medications: string[];
  allergies: string[];
  eventType: string;
  timestamp: string;
}): Promise<string> {
  if (env.DEMO_MODE) {
    return `UNRESPONSIVE FALL DETECTED at ${data.timestamp}. Patient: ${data.patientName} (${data.age}yo). Meds: ${data.medications.join(', ')}. Allergies: ${data.allergies.join(', ') || 'None known'}.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Generate a concise emergency alert message for a caregiver. Keep it under 280 characters.

Event: ${data.eventType}
Time: ${data.timestamp}
Patient: ${data.patientName}, ${data.age} years old
Current Medications: ${data.medications.join(', ') || 'None'}
Known Allergies: ${data.allergies.join(', ') || 'None'}

Format: Start with the alert type in CAPS, include time, patient name+age, critical meds, and allergies.`,
            },
          ],
        },
      ],
    });

    return response.text ?? `ALERT: ${data.eventType} detected for ${data.patientName} at ${data.timestamp}`;
  } catch (err) {
    console.warn('[GEMINI] Emergency context synthesis fallback used:', err);
    return `EMERGENCY ALERT: ${data.eventType} detected for ${data.patientName} (${data.age}yo) at ${data.timestamp}. Immediate caregiver check required.`;
  }
}

// ──────────────────────────────────────
// Multilingual Conversational & Health Voice Assistant
// ──────────────────────────────────────
export async function processVoiceCompanion(data: {
  text: string;
  patientName?: string;
  nextMedication?: string;
  currentTime?: string;
  currentLanguage?: string;
}): Promise<{
  intent: 'DISTRESS' | 'SAFE' | 'QUERY' | 'CONVERSATIONAL';
  reply: string;
  detectedLanguage: string;
  detectedLanguageCode: string;
  urgency: 'high' | 'medium' | 'low';
}> {
  const userSpeech = data.text?.trim();
  if (!userSpeech) {
    return {
      intent: 'CONVERSATIONAL',
      reply: 'नमस्ते, मैं आपकी क्या सहायता कर सकता हूँ?',
      detectedLanguage: 'Hindi',
      detectedLanguageCode: 'hi-IN',
      urgency: 'low',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are 'Sarthak' (सार्थक), a compassionate, protective, multilingual AI companion and emergency telecare guardian for Indian senior citizens.
The senior citizen just spoke to you hands-free:
"${userSpeech}"

Patient context:
- Senior name: ${data.patientName || 'Respected elder'}
- Next scheduled medication: ${data.nextMedication || 'No medicines scheduled right now'}
- Current time: ${data.currentTime || new Date().toLocaleTimeString('en-IN')}

CRITICAL INSTRUCTIONS:
1. Common people speak naturally in ANY language: Hindi, English, Hinglish, Kannada, Tamil, Telugu, Marathi, Bengali, Gujarati, Punjabi, Malayalam, etc.
2. Understand what they mean, NOT just rigid keywords. Understand emotional cries, distress, feeling dizzy, chest pain, fallen down, asking to call family/doctor, general health queries, or friendly conversation.
3. Return ONLY a valid JSON object matching this structure:
{
  "intent": "DISTRESS" | "SAFE" | "QUERY" | "CONVERSATIONAL",
  "urgency": "high" | "medium" | "low",
  "detectedLanguage": "name of language e.g. Hindi, English, Kannada, Marathi",
  "detectedLanguageCode": "BCP-47 code e.g. hi-IN, en-IN, kn-IN, ta-IN, mr-IN, bn-IN, pa-IN, te-IN",
  "reply": "Short, natural, warm 1-2 sentence spoken reply in the EXACT SAME LANGUAGE and script/transliteration the user spoke. Respectful elder-friendly tone (use 'Aap', 'Ji')."
}

Intent guide:
- DISTRESS: If the user indicates pain, fall, dizziness, feeling sick, crying for help, asking to call son/daughter/doctor/ambulance, shortness of breath, or any emergency (e.g. 'bachao', 'gir gaya', 'sar ghum raha hai', 'chhati me dard hai', 'kisi ko bulao', 'help me please', 'kaapadie').
  Reply MUST reassure them immediately that family and doctor/caregiver are being phoned right now. Urgency: high.
- SAFE: If the user says they are fine, safe, false alarm, or help has arrived (e.g. 'main theek hoon', 'chinta mat karo', 'galti se ho gaya', 'all good', 'help aa gayi').
  Reply MUST confirm alert is dismissed and they are safe. Urgency: low.
- QUERY: If asking about time, medication, doctor appointments, or Sarthak features.
  Reply directly with the requested information.
- CONVERSATIONAL: Friendly chat, greetings, asking how Sarthak is doing, asking who you are.
  Reply with warm Indian hospitality and respect.`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    return {
      intent: parsed.intent || 'CONVERSATIONAL',
      reply: parsed.reply || (data.currentLanguage === 'hi' ? 'जी, मैं आपकी सुन रहा हूँ।' : 'I hear you, how can I help?'),
      detectedLanguage: parsed.detectedLanguage || 'English',
      detectedLanguageCode: parsed.detectedLanguageCode || 'en-IN',
      urgency: parsed.urgency || 'low',
    };
  } catch (err) {
    console.warn('[VOICE] Gemini voice parsing failed/quota reached, using offline Multilingual NLP:', err);

    const lower = userSpeech.toLowerCase().trim();

    // 1. Multilingual Distress Detection (All Indian languages, dialects & colloquialisms)
    const distressPatterns = [
      // English
      /\b(help|help me|emergency|i fell|fallen|cannot get up|can't get up|call doctor|call family|call ambulance|ambulance|chest pain|dizzy|save me|please help|urgent|stroke|heart attack|trouble breathing|pain)\b/i,
      // Hindi / Hinglish / Urdu
      /बचाओ|मदद|सहायता|दर्द|चक्कर|तबीयत|बीमार|तकलीफ|तकलीफ़|छाती|सांस|साँस|उठ|उठा|गिर|गिरा|गिरी|डॉक्टर|अस्पताल|एम्बुलेंस|कॉल|फ़ोन|फोन|चोट|खून|घबराहट|बेहोश|कष्ट|हेल्प|हैल्प|हैलप|परेशानी|बुलाओ|मददगार/i,
      /\b(bachao|madad|sahayata|gir gaya|gir gayi|gir pada|gira|giri|uth nahi|utha nahi|dard|chhati|sar ghum|sir ghum|chakkar|doctor|daktar|ambulance|hospital|call karo|phone karo|chot|khoon|ghabrahat|behosh|help|help me|emergency|takleef|taklif|tabiyat|bimar|beemar)\b/i,
      // Kannada
      /ಸಹಾಯ|ಕಾಪಾಡಿ|ಬಿದ್ದಿದ್ದೇನೆ|ನೋವು|ಎದ್ದೇಳಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ|ವೈದ್ಯರನ್ನು ಕರೆಯಿರಿ|ಆಸ್ಪತ್ರೆ/i,
      /\b(sahaya|kaapadi|biddiddene|novu|vaidyarannu kareyiri)\b/i,
      // Tamil
      /உதவி|காப்பாற்றுங்கள்|விழுந்துவிட்டேன்|வலிக்குது|மருத்துவரை அழையுங்கள்/i,
      /\b(udhavi|kaappatrrungal|vizhundhuvittean|valikkudhu)\b/i,
      // Telugu
      /సహాయం|కాపాడండి|పడిపోయాను|నొప్పిగా ఉంది|వైద్యుడిని పిలవండి/i,
      /\b(sahaayam|kaapaadandi|padipoyaanu|noppigaa undi)\b/i,
      // Marathi
      /वाचवा|मदत करा|मी पडलो|मी पडले|दुखत आहे|चक्कर येत आहे|डॉक्टरांना बोलवा/i,
      /\b(vaachva|madat kara|mi padlo|dukhat aahe|chakkar yet aahe)\b/i,
      // Bengali
      /বাঁচাও|সাহায্য করুন|আমি পড়ে গেছি|খুব ব্যথা|ডাক্তার ডাকুন/i,
      /\b(baanchao|sahajjo korun|pore gechi|byatha|daktar)\b/i,
      // Punjabi
      /ਬਚਾਓ|ਮਦਦ ਕਰੋ|ਮੈਂ ਡਿੱਗ ਪਿਆ|ਮੈਂ ਡਿੱਗ ਪਈ|ਦਰਦ ਹੋ ਰਿਹਾ|ਡਾਕਟਰ ਨੂੰ ਬੁਲਾਓ/i,
      /\b(bachao|madad karo|main digg peya|dard ho reha)\b/i,
    ];

    const isDistress = distressPatterns.some((p) => p.test(userSpeech) || p.test(lower));

    if (isDistress) {
      let replyText = 'Emergency distress heard. Calling your designated caregiver immediately. Please stay calm.';
      let code = 'en-IN';
      let lang = 'English';

      if (/[\u0900-\u097F]/.test(userSpeech) || /bachao|madad|gir|dard|chakkar|doctor|tabiyat|takleef|chhati|saans|ghabrahat|bimar|behosh/i.test(lower) || data.currentLanguage === 'hi') {
        replyText = 'आपातकालीन सहायता सुनी गई। आपके परिवार और देखभालकर्ता को तुरंत कॉल की जा रही है। आप बिल्कुल शांत रहें, सहायता भेजी जा रही है।';
        code = 'hi-IN';
        lang = 'Hindi';
      } else if (/[\u0C80-\u0CFF]/.test(userSpeech) || /sahaya|kaapadi|biddi/i.test(lower)) {
        replyText = 'ತುರ್ತು ಸಹಾಯವನ್ನು ಕೇಳಲಾಗಿದೆ. ನಿಮ್ಮ ಆರೈಕೆದಾರರಿಗೆ ತಕ್ಷಣ ಕರೆ ಮಾಡಲಾಗುತ್ತಿದೆ.';
        code = 'kn-IN';
        lang = 'Kannada';
      } else if (/[\u0B80-\u0BFF]/.test(userSpeech) || /udhavi|kaappa/i.test(lower)) {
        replyText = 'அவசர உதவி கோரப்பட்டது. உங்கள் பராமரிப்பாளருக்கு உடனடியாக அழைக்கப்படுகிறது.';
        code = 'ta-IN';
        lang = 'Tamil';
      }

      return {
        intent: 'DISTRESS',
        reply: replyText,
        detectedLanguage: lang,
        detectedLanguageCode: code,
        urgency: 'high',
      };
    }

    // 2. Multilingual Safe & Resolved Detection
    const safePatterns = [
      /\b(i am ok|i am okay|i am fine|i'm ok|i'm okay|i'm fine|all good|false alarm|cancel|safe|no problem|help arrived|help is here|safe now|dismiss)\b/i,
      /मैं ठीक हूँ|ठीक हूँ|ठीक हु|कोई बात नहीं|सब ठीक है|चिंता मत करो|चिंता न करो|मदद मिल गई|अलार्म बंद|सुरक्षित हूँ|सुरक्षित/i,
      /\b(main theek hoon|theek hoon|thik hu|thik hai|theek hai|koi baat nahi|sab theek|chinta mat karo|chinta na karo|madad mil gayi|help aa gayi|safe)\b/i,
      /ನಾನು ಆರಾಮಾಗಿದ್ದೇನೆ|ಪರವಾಗಿಲ್ಲ|ಸಹಾಯ ಸಿಕ್ಕಿತು|ಎಲ್ಲವೂ ಸರಿ/i,
      /நான் நலமாக இருக்கிறேன்|எல்லாம் சரி/i,
      /నేను బాగున్నాను|సహాయం అందింది/i,
    ];

    const isSafe = safePatterns.some((p) => p.test(userSpeech) || p.test(lower));

    if (isSafe) {
      let replyText = 'Alert cancelled. Glad to hear you are safe and sound.';
      let code = 'en-IN';
      let lang = 'English';

      if (/[\u0900-\u097F]/.test(userSpeech) || /theek|thik|chinta|madad|surakshit/i.test(lower) || data.currentLanguage === 'hi') {
        replyText = 'अलार्म रद्द कर दिया गया है। मुझे बहुत खुशी है कि आप बिल्कुल सुरक्षित हैं।';
        code = 'hi-IN';
        lang = 'Hindi';
      } else if (/[\u0C80-\u0CFF]/.test(userSpeech)) {
        replyText = 'ಎಚ್ಚರಿಕೆಯನ್ನು ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ. ನೀವು ಸುರಕ್ಷಿತವಾಗಿರುವುದಕ್ಕೆ ಸಂತೋಷವಾಗಿದೆ.';
        code = 'kn-IN';
        lang = 'Kannada';
      }

      return {
        intent: 'SAFE',
        reply: replyText,
        detectedLanguage: lang,
        detectedLanguageCode: code,
        urgency: 'low',
      };
    }

    // 3. Time Queries (Multilingual)
    if (/\b(time|clock|samay|kitne baje|samaya|neram|velai)\b/i.test(lower) || /समय|कितने बजे|वेळ|সময়/i.test(userSpeech)) {
      const timeStr = data.currentTime || new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
      const isHi = /[\u0900-\u097F]/.test(userSpeech) || /samay|kitne|baje/i.test(lower) || data.currentLanguage === 'hi';
      return {
        intent: 'QUERY',
        reply: isHi ? `वर्तमान समय ${timeStr} है।` : `The current time is ${timeStr}.`,
        detectedLanguage: isHi ? 'Hindi' : 'English',
        detectedLanguageCode: isHi ? 'hi-IN' : 'en-IN',
        urgency: 'low',
      };
    }

    // 4. Medication Queries (Multilingual)
    if (/\b(medicine|pill|medication|tablet|dawai|goli|khuraak|maathre|marundhu|mandhu)\b/i.test(lower) || /दवाई|दवा|गोली|खुराक|औषध|ঔষধ/i.test(userSpeech)) {
      const medText = data.nextMedication || 'फिलहाल कोई दवाई निर्धारित नहीं है।';
      const isHi = /[\u0900-\u097F]/.test(userSpeech) || /dawai|goli|khuraak/i.test(lower) || data.currentLanguage === 'hi';
      return {
        intent: 'QUERY',
        reply: isHi ? `आपकी अगली खुराक: ${medText}। समय पर दवाई अवश्य लें।` : `Your next scheduled dose: ${medText}. Remember to take it on time.`,
        detectedLanguage: isHi ? 'Hindi' : 'English',
        detectedLanguageCode: isHi ? 'hi-IN' : 'en-IN',
        urgency: 'low',
      };
    }

    // 5. Conversational Greetings & Friendly Interaction
    if (/\b(namaste|namaskar|hello|hi|kaise ho|how are you|good morning|kya haal|shukriya|dhanyawad|thank you|aap kaun ho|who are you|sarthak)\b/i.test(lower) || /नमस्ते|नमस्कार|कैसे हो|धन्यवाद|प्रणाम|सार्थक/i.test(userSpeech)) {
      const isHi = /[\u0900-\u097F]/.test(userSpeech) || /namaste|kaise|haal|kaun|sarthak/i.test(lower) || data.currentLanguage === 'hi';
      return {
        intent: 'CONVERSATIONAL',
        reply: isHi
          ? `नमस्ते जी! मैं सार्थक हूँ, आपका व्यक्तिगत स्वास्थ्य और सुरक्षा साथी। मैं बिल्कुल ठीक हूँ, आप कैसे हैं?`
          : `Hello! I am Sarthak, your personal health and telecare companion. I am doing well, how can I care for you today?`,
        detectedLanguage: isHi ? 'Hindi' : 'English',
        detectedLanguageCode: isHi ? 'hi-IN' : 'en-IN',
        urgency: 'low',
      };
    }

    // Default conversational comprehension
    const isHindiScript = /[\u0900-\u097F]/.test(userSpeech) || data.currentLanguage === 'hi' || /bachao|madad|dard|theek|kaise|aap/i.test(lower);
    return {
      intent: 'CONVERSATIONAL',
      reply: isHindiScript
        ? `जी, मैंने आपकी बात सुनी: "${userSpeech}"। मैं हमेशा आपकी सहायता और सुरक्षा के लिए यहाँ उपस्थित हूँ।`
        : `I heard you say: "${userSpeech}". I am right here by your side to help you anytime.`,
      detectedLanguage: isHindiScript ? 'Hindi' : 'English',
      detectedLanguageCode: isHindiScript ? 'hi-IN' : 'en-IN',
      urgency: 'low',
    };
  }
}
