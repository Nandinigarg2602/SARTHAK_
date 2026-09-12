import { Request, Response, NextFunction } from 'express';

const requestCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * IP-based rate limiter.
 * @param maxRequests Maximum requests per window
 * @param windowMs Window duration in milliseconds
 */
export function rateLimiter(maxRequests = 30, windowMs = 60_000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record || now > record.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
      });
      return;
    }

    record.count++;
    next();
  };
}
