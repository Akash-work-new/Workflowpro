import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const JWT_SECRET = process.env.JWT_SECRET || 'workflow_pro_secret_key_123';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    employeeId: string;
    name: string;
    email: string;
    role: {
      name: string;
      permissions: string[];
    };
    departmentId: string | null;
    managerId: string | null;
    status: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authorization token required',
        },
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User session no longer valid',
        },
      });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Your account has been deactivated',
        },
      });
    }

    // Parse permissions from Json database type
    let permissions: string[] = [];
    try {
      if (typeof user.role.permissions === 'string') {
        permissions = JSON.parse(user.role.permissions);
      } else if (Array.isArray(user.role.permissions)) {
        permissions = user.role.permissions as string[];
      }
    } catch (e) {
      permissions = [];
    }

    req.user = {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: {
        name: user.role.name,
        permissions,
      },
      departmentId: user.departmentId,
      managerId: user.managerId,
      status: user.status,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Session expired',
        },
      });
    }
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization token',
      },
    });
  }
};
