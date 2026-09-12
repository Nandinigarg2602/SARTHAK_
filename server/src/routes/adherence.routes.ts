import { Router, Request, Response } from 'express';
import multer from 'multer';
import { AdherenceLog } from '../models/AdherenceLog.js';
import { authenticate } from '../middleware/auth.js';
import * as geminiService from '../services/gemini.service.js';

export const adherenceRoutes = Router();
adherenceRoutes.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for video
});

// POST /api/adherence/verify — Upload video clip → VLM verification
adherenceRoutes.post(
  '/verify',
  upload.single('video'),
  async (req: Request, res: Response) => {
    try {
      const { medicationId, scheduledTime } = req.body;

      let videoBase64: string;
      if (req.file) {
        videoBase64 = req.file.buffer.toString('base64');
      } else if (req.body.videoBase64) {
        videoBase64 = req.body.videoBase64;
      } else {
        res.status(400).json({ success: false, error: 'Video clip required' });
        return;
      }

      // Verify with Gemini VLM
      const result = await geminiService.verifyAdherence(videoBase64);

      // Log adherence
      const log = await AdherenceLog.create({
        userId: req.userId,
        medicationId,
        scheduledTime: new Date(scheduledTime),
        takenTime: result.isTakingMedication ? new Date() : undefined,
        status: result.isTakingMedication ? 'TAKEN' : 'FLAGGED_WRONG_MED',
        verifiedByVision: true,
        visionConfidence: result.confidence,
        pillDescription: result.pillDescription,
      });

      res.json({
        success: true,
        data: {
          adherenceLog: log,
          visionResult: result,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/adherence/:userId — Get adherence history
adherenceRoutes.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, medicationId } = req.query;

    const filter: Record<string, any> = { userId: req.params.userId };

    if (startDate || endDate) {
      filter.scheduledTime = {};
      if (startDate) filter.scheduledTime.$gte = new Date(startDate as string);
      if (endDate) filter.scheduledTime.$lte = new Date(endDate as string);
    }

    if (medicationId) {
      filter.medicationId = medicationId;
    }

    const logs = await AdherenceLog.find(filter)
      .populate('medicationId', 'drugName dosage')
      .sort({ scheduledTime: -1 })
      .limit(100);

    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

import { sseClients } from './alert.routes.js';

function broadcastAdherence(userId: string, data: any) {
  const clients = sseClients.get(String(userId));
  if (clients) {
    const payload = JSON.stringify({ type: 'adherence_logged', data });
    for (const client of clients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch {}
    }
  }
}

// POST /api/adherence/log — Manual or vision adherence logging
adherenceRoutes.post('/log', async (req: Request, res: Response) => {
  try {
    const { medicationId, scheduledTime, status, verifiedByVision } = req.body;

    const log = await AdherenceLog.create({
      userId: req.userId,
      medicationId,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date(),
      takenTime: status === 'TAKEN' ? new Date() : undefined,
      status: status || 'TAKEN',
      verifiedByVision: verifiedByVision === true,
      visionConfidence: verifiedByVision ? 0.95 : undefined,
    });

    const populated = await log.populate('medicationId', 'drugName dosage');
    broadcastAdherence(String(req.userId), populated);

    res.status(201).json({ success: true, data: populated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
