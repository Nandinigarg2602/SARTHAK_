import { Router, Request, Response } from 'express';
import { EventLog } from '../models/EventLog.js';
import { authenticate } from '../middleware/auth.js';
import * as escalationService from '../services/escalation.service.js';

export const alertRoutes = Router();

// SSE client registry (exported for escalation service to broadcast)
export const sseClients = new Map<string, Response[]>();

// POST /api/alerts/escalate — Trigger escalation pipeline
alertRoutes.post('/escalate', authenticate, async (req: Request, res: Response) => {
  try {
    const { userId, eventType, metadata } = req.body;
    const targetUserId = userId || req.userId;

    const event = await escalationService.triggerEscalation(
      targetUserId,
      eventType,
      metadata || {}
    );

    res.status(201).json({ success: true, data: event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/:id/resolve — Mark alert resolved
alertRoutes.post('/:id/resolve', authenticate, async (req: Request, res: Response) => {
  try {
    const event = await EventLog.findByIdAndUpdate(
      req.params.id,
      { escalationStatus: 'RESOLVED' },
      { new: true }
    );

    if (!event) {
      res.status(404).json({ success: false, error: 'Event not found' });
      return;
    }

    escalationService.cancelEscalation(req.params.id);
    res.json({ success: true, data: event });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/:id/false-alarm — Mark as false alarm + adjust sensitivity
alertRoutes.post(
  '/:id/false-alarm',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const event = await escalationService.markFalseAlarm(req.params.id);

      if (!event) {
        res.status(404).json({ success: false, error: 'Event not found' });
        return;
      }

      res.json({ success: true, data: event });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// GET /api/alerts/:userId — Get event log feed
alertRoutes.get('/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    const { eventType, limit } = req.query;

    const filter: Record<string, any> = { userId: req.params.userId };
    if (eventType) filter.eventType = eventType;

    const events = await EventLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    res.json({ success: true, data: events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts/sse/:userId — Server-Sent Events for real-time dashboard
alertRoutes.get('/sse/:userId', authenticate, (req: Request, res: Response) => {
  const userId = req.params.userId;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  // Register this client
  if (!sseClients.has(userId)) {
    sseClients.set(userId, []);
  }
  sseClients.get(userId)!.push(res);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30_000);

  // Cleanup on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      const index = clients.indexOf(res);
      if (index > -1) clients.splice(index, 1);
      if (clients.length === 0) sseClients.delete(userId);
    }
  });
});
