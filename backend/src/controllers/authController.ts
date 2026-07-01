import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import prisma from '../config/db';
import { logAudit } from '../services/auditService';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const JWT_SECRET = process.env.JWT_SECRET || 'workflow_pro_secret_key_123';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'workflow_pro_refresh_key_456';

// Register User
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, designation, employeeId, phoneNumber, departmentId } = req.body;

    if (!name || !email || !password || !designation || !employeeId) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing required fields' },
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeId }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'User with this email or employee ID already exists',
        },
      });
    }

    // Default to AGENT role if not provided
    let agentRole = await prisma.role.findFirst({ where: { name: 'AGENT' } });
    if (!agentRole) {
      // Fallback fallback if seed didn't run yet
      agentRole = await prisma.role.create({
        data: {
          name: 'AGENT',
          permissions: JSON.stringify(['VIEW_MY_TASKS', 'UPDATE_MY_TASKS', 'CREATE_COMMENT']),
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        designation,
        employeeId,
        phoneNumber,
        departmentId: departmentId || null,
        roleId: agentRole.id,
        emailVerificationToken: verificationToken,
      },
      include: {
        role: true,
      },
    });

    await logAudit(req, 'USER_REGISTERED', {
      userId: newUser.id,
      email: newUser.email,
      employeeId: newUser.employeeId,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        employeeId: newUser.employeeId,
        role: newUser.role.name,
        message: 'Registration successful. Please verify email.',
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
};

// Login User
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing email or password' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
      });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Your account is currently inactive.' },
      });
    }

    // Check if 2FA is enabled
    if (user.isTwoFactorEnabled) {
      const tempToken = jwt.sign(
        { userId: user.id, tempAuth: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({
        success: true,
        data: {
          twoFactorRequired: true,
          tempToken,
        },
      });
    }

    // Standard Login Tokens
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await logAudit(req, 'USER_LOGIN', { userId: user.id, email: user.email });

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: {
            name: user.role.name,
            permissions: typeof user.role.permissions === 'string' ? JSON.parse(user.role.permissions) : user.role.permissions,
          },
          status: user.status,
          profilePhoto: user.profilePhoto,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Internal server error' },
    });
  }
};

// Refresh Token
export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Refresh token is required' },
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { role: true },
    });

    if (!user || user.status === 'INACTIVE') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Session invalid or user inactive' },
      });
    }

    const newAccessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const newRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
    });
  }
};

// Setup 2FA
export const setup2FA = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'WorkFlow Pro', secret);
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return res.json({
      success: true,
      data: {
        secret,
        qrCodeUrl,
      },
    });
  } catch (error) {
    console.error('Setup 2FA error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to setup 2FA' } });
  }
};

// Verify 2FA
export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { token, tempToken, isSetup } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'OTP Token required' },
      });
    }

    let userId: string;

    if (isSetup) {
      // User is enabling 2FA while logged in
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.id) {
        return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });
      }
      userId = authReq.user.id;
    } else {
      // User is logging in
      if (!tempToken) {
        return res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Temporary token required for login verification' },
        });
      }
      const decoded = jwt.verify(tempToken, JWT_SECRET) as { userId: string; tempAuth: boolean };
      userId = decoded.userId;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: '2FA has not been initiated for this account' },
      });
    }

    const isValid = authenticator.verify({
      token,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid verification code' },
      });
    }

    // Update user: Set 2FA as fully enabled if we are in setup mode
    if (isSetup) {
      await prisma.user.update({
        where: { id: userId },
        data: { isTwoFactorEnabled: true },
      });
      await logAudit(req, 'USER_2FA_ENABLED', { userId });
      return res.json({
        success: true,
        data: { message: 'Two-factor authentication successfully enabled' },
      });
    }

    // Complete login
    const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await logAudit(req, 'USER_LOGIN_2FA', { userId: user.id, email: user.email });

    return res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: {
            name: user.role.name,
            permissions: typeof user.role.permissions === 'string' ? JSON.parse(user.role.permissions) : user.role.permissions,
          },
          status: user.status,
          profilePhoto: user.profilePhoto,
        },
      },
    });
  } catch (error) {
    console.error('2FA Verification error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to verify 2FA token' },
    });
  }
};

// Verify Email Route
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: { message: 'Token is required' } });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { email: string };
    
    await prisma.user.update({
      where: { email: decoded.email },
      data: { isEmailVerified: true, emailVerificationToken: null },
    });

    return res.json({
      success: true,
      data: { message: 'Email verified successfully!' },
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: { message: 'Invalid or expired email verification token' },
    });
  }
};

// Forgot Password
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'Email required' } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Silent success for security, or explicit
      return res.json({ success: true, data: { message: 'If user exists, a password reset link has been dispatched.' } });
    }

    const resetToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken },
    });

    // In production, send email here. In dev, we return the token directly in the API for ease of testing!
    return res.json({
      success: true,
      data: {
        message: 'Password reset token generated.',
        resetToken, // Returned for testing purposes in dev
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Failed to initiate forgot password' } });
  }
};

// Reset Password
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: { message: 'Missing token or new password' } });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.passwordResetToken !== token) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired reset token' } });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
      },
    });

    await logAudit(req, 'USER_PASSWORD_RESET', { userId: user.id });

    return res.json({ success: true, data: { message: 'Password reset successfully!' } });
  } catch (error) {
    return res.status(400).json({ success: false, error: { message: 'Invalid token' } });
  }
};
