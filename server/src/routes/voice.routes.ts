import { Router, Request, Response } from 'express';
import { processVoiceCompanion } from '../services/gemini.service.js';

export const voiceRoutes = Router();

// POST /api/voice/process — Multilingual Conversational & Distress Voice AI
voiceRoutes.post('/process', async (req: Request, res: Response) => {
  try {
    const { text, patientName, nextMedication, currentTime, currentLanguage } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: 'Text prompt is required' });
      return;
    }

    const result = await processVoiceCompanion({
      text,
      patientName,
      nextMedication,
      currentTime,
      currentLanguage,
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
