import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User, IUser } from '../models/User.js';

// Extend Express Request to carry user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      userId?: string;
    }
  }
}

/**
 * Standard JWT authentication from HttpOnly cookie or Authorization header.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check cookie first, then Authorization header
    const token =
      req.cookies?.token ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      res.status(401).json({ success: false, error: 'User not found' });
      return;
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Validates single-use emergency link tokens.
 */
export function validateEmergencyToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const token = req.query.token as string;
    if (!token) {
      res.status(401).json({ success: false, error: 'Emergency token required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      eventId: string;
      type: 'emergency';
    };

    if (decoded.type !== 'emergency') {
      res.status(401).json({ success: false, error: 'Invalid token type' });
      return;
    }

    (req as any).eventId = decoded.eventId;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Expired or invalid emergency link' });
  }
}

/**
 * Enforces role-based route access (patient vs caregiver).
 */
export function requireRole(allowedRoles: ('patient' | 'caregiver' | 'senior')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }
    const userRole = req.user.role === 'senior' ? 'patient' : req.user.role;
    const normalizedAllowed = allowedRoles.map((r) => (r === 'senior' ? 'patient' : r));
    if (!normalizedAllowed.includes(userRole as any)) {
      res.status(403).json({
        success: false,
        error: `Access restricted. This area is only available for ${allowedRoles.join(' or ')} accounts.`,
      });
      return;
    }
    next();
  };
}
