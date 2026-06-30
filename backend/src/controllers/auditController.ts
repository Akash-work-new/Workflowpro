import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const getAuditLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, employeeId: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 100, // Cap at last 100 records for performance
    });

    return res.json({
      success: true,
      data: logs.map((log) => {
        let parsedDetails = {};
        try {
          parsedDetails = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
        } catch {
          parsedDetails = {};
        }
        return {
          ...log,
          details: parsedDetails,
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
