import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: string; phone: string; trust_level: string; account_type: string };
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    
    // Quick DB check to prevent stale sessions after database reset
    const pool = require('../db/database').default;
    pool.query('SELECT id FROM users WHERE id = $1', [payload.id]).then((r: any) => {
        if (r.rows.length === 0) {
            return res.status(401).json({ error: 'User session no longer valid' });
        }
        req.user = payload;
        next();
    }).catch((e: any) => {
        res.status(500).json({ error: 'Authentication engine error' });
    });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
