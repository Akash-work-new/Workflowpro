import { Request } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const logAudit = async (
  req: Request,
  action: string,
  details: any
) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id || null;
    
    // Get IP address from headers or connection
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string) || 
      req.ip || 
      req.socket.remoteAddress || 
      '127.0.0.1';

    const userAgent = req.headers['user-agent'] || 'unknown';

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        details: details ? JSON.stringify(details) : '{}',
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
