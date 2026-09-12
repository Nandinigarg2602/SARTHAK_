import { Router, Request, Response } from 'express';
import multer from 'multer';
import { Medication } from '../models/Medication.js';
import { authenticate } from '../middleware/auth.js';
import * as geminiService from '../services/gemini.service.js';

export const medicationRoutes = Router();
medicationRoutes.use(authenticate);

// Multer: in-memory storage for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// POST /api/medications/scan — Upload medicine image → VLM parse → interaction check
medicationRoutes.post(
  '/scan',
  upload.single('image'),
  async (req: Request, res: Response) => {
    try {
      let imageBase64: string;

      if (req.file) {
        imageBase64 = req.file.buffer.toString('base64');
      } else if (req.body.imageBase64) {
        imageBase64 = req.body.imageBase64;
      } else {
        res.status(400).json({ success: false, error: 'Image required' });
        return;
      }

      // 1. Scan medication from image
      const scanResult = await geminiService.scanMedication(imageBase64);

      // 2. Fetch existing medications for interaction check
      const userId = req.userId!;
      const existingMeds = await Medication.find({ userId, isActive: true });

      const allMeds = [
        ...existingMeds.map((m) => ({
          drugName: m.drugName,
          dosage: m.dosage,
        })),
        ...scanResult.medications.map((m: any) => ({
          drugName: m.drugName,
          dosage: m.dosage,
        })),
      ];

      // 3. Check interactions if more than 1 medication
      let interactions = { interactions: [], overallRisk: 'Low' };
      if (allMeds.length > 1) {
        interactions = await geminiService.checkInteractions(allMeds);
      }

      res.json({
        success: true,
        data: {
          scannedMedications: scanResult.medications,
          interactions,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/medications/:userId — List all active medications
medicationRoutes.get('/:userId', async (req: Request, res: Response) => {
  try {
    const medications = await Medication.find({
      userId: req.params.userId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: medications });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/medications — Add medication (from scan confirmation or manual)
medicationRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const {
      drugName,
      dosage,
      frequency,
      scheduledTimes,
      instructions,
      knownInteractions,
    } = req.body;

    const medication = await Medication.create({
      userId: req.userId,
      drugName,
      dosage,
      frequency,
      scheduledTimes: scheduledTimes || [],
      instructions: instructions || '',
      knownInteractions: knownInteractions || [],
    });

    res.status(201).json({ success: true, data: medication });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/medications/:id — Update medication
medicationRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!medication) {
      res.status(404).json({ success: false, error: 'Medication not found' });
      return;
    }

    res.json({ success: true, data: medication });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/medications/:id — Soft-delete (mark inactive)
medicationRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const medication = await Medication.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!medication) {
      res.status(404).json({ success: false, error: 'Medication not found' });
      return;
    }

    res.json({ success: true, message: 'Medication deactivated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
