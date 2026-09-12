import { Router, Request, Response } from 'express';
import { User } from '../models/User.js';
import { authenticate } from '../middleware/auth.js';

export const userRoutes = Router();

// All user routes require authentication
userRoutes.use(authenticate);

// GET /api/users/:id
userRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id
userRoutes.put('/:id', async (req: Request, res: Response) => {
  try {
    const { fullName, age, primaryLanguage, allergies, emergencyContacts } =
      req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        ...(fullName && { fullName }),
        ...(age && { age }),
        ...(primaryLanguage && { primaryLanguage }),
        ...(allergies && { allergies }),
        ...(emergencyContacts && { emergencyContacts }),
      },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/users/:id/sensitivity
userRoutes.put('/:id/sensitivity', async (req: Request, res: Response) => {
  try {
    const { fallDetectionThreshold, graceWindowSeconds } = req.body;

    const update: Record<string, number> = {};
    if (fallDetectionThreshold !== undefined) {
      update['sensitivitySettings.fallDetectionThreshold'] = fallDetectionThreshold;
    }
    if (graceWindowSeconds !== undefined) {
      update['sensitivitySettings.graceWindowSeconds'] = graceWindowSeconds;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).select('-password');

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user.sensitivitySettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
