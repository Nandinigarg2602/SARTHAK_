import { Router, Request, Response } from 'express';
import { EventLog } from '../models/EventLog.js';
import { User } from '../models/User.js';
import { Medication } from '../models/Medication.js';
import { AdherenceLog } from '../models/AdherenceLog.js';
import { validateEmergencyToken } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

export const emergencyRoutes = Router();

// GET /api/emergency/v1?token=... — Public emergency context page data
emergencyRoutes.get(
  '/v1',
  rateLimiter(10, 60_000), // 10 requests per minute max
  validateEmergencyToken,
  async (req: Request, res: Response) => {
    try {
      const eventId = (req as any).eventId;

      // Fetch event
      const event = await EventLog.findById(eventId);
      if (!event) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }

      // Fetch patient data
      const user = await User.findById(event.userId).select(
        'fullName age allergies emergencyContacts primaryLanguage'
      );

      if (!user) {
        res.status(404).json({ success: false, error: 'Patient not found' });
        return;
      }

      // Fetch active medications
      const medications = await Medication.find({
        userId: event.userId,
        isActive: true,
      }).select('drugName dosage frequency');

      // Fetch recent adherence (last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentAdherence = await AdherenceLog.find({
        userId: event.userId,
        createdAt: { $gte: oneDayAgo },
      })
        .populate('medicationId', 'drugName')
        .sort({ createdAt: -1 });

      // Fetch recent events (last 24h)
      const recentEvents = await EventLog.find({
        userId: event.userId,
        createdAt: { $gte: oneDayAgo },
      }).sort({ createdAt: -1 });

      res.json({
        success: true,
        data: {
          event: {
            type: event.eventType,
            status: event.escalationStatus,
            summary: event.contextSummary,
            timestamp: event.createdAt,
          },
          patient: {
            fullName: user.fullName,
            age: user.age,
            allergies: user.allergies,
            language: user.primaryLanguage,
            emergencyContacts: user.emergencyContacts,
          },
          medications,
          recentAdherence,
          recentEvents,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// POST /api/emergency/v1/ack?token=... — Acknowledge emergency
emergencyRoutes.post(
  '/v1/ack',
  rateLimiter(5, 60_000),
  validateEmergencyToken,
  async (req: Request, res: Response) => {
    try {
      const eventId = (req as any).eventId;

      const event = await EventLog.findByIdAndUpdate(
        eventId,
        { escalationStatus: 'RESOLVED' },
        { new: true }
      );

      if (!event) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }

      res.json({ success: true, message: 'Emergency acknowledged' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
