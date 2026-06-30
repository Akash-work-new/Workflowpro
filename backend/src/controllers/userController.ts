import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';

// Fetch current user profile
export const getProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const profile = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        department: true,
        manager: {
          select: { id: true, name: true, email: true, designation: true },
        },
        subordinates: {
          select: { id: true, name: true, email: true, designation: true, status: true },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({ success: false, error: { message: 'Profile not found' } });
    }

    // Parse role permissions if they are JSON string
    let permissions = [];
    try {
      permissions = JSON.parse(profile.role.permissions);
    } catch {
      permissions = Array.isArray(profile.role.permissions) ? profile.role.permissions : [];
    }

    return res.json({
      success: true,
      data: {
        ...profile,
        role: {
          ...profile.role,
          permissions,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Update current user profile
export const updateProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { name, phoneNumber, profilePhoto, designation } = req.body;
    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        phoneNumber,
        profilePhoto,
        designation,
      },
      include: { role: true },
    });

    await logAudit(req, 'USER_UPDATE_PROFILE', {
      updatedFields: { name, phoneNumber, profilePhoto, designation },
    });

    return res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Transition status
export const updateStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status } = req.body;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'BREAK', 'MEETING'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid status. Choose from ACTIVE, INACTIVE, ON_LEAVE, BREAK, MEETING' },
      });
    }

    if (!userId) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    await logAudit(req, 'USER_UPDATE_STATUS', {
      oldStatus: req.user?.status,
      newStatus: status,
    });

    return res.json({
      success: true,
      data: {
        id: updatedUser.id,
        status: updatedUser.status,
      },
    });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// List all users (Admin / Lead only)
export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { departmentId, role } = req.query;

    const whereClause: any = {};
    if (departmentId) whereClause.departmentId = departmentId as string;
    if (role) {
      whereClause.role = { name: role as string };
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        role: true,
        department: true,
        manager: {
          select: { id: true, name: true, designation: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      data: users.map((u) => {
        let permissions = [];
        try {
          permissions = JSON.parse(u.role.permissions);
        } catch {
          permissions = Array.isArray(u.role.permissions) ? u.role.permissions : [];
        }
        return {
          ...u,
          role: { ...u.role, permissions },
        };
      }),
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Change user role (Super Admin / Admin only)
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;

    if (!roleId) {
      return res.status(400).json({ success: false, error: { message: 'Role ID required' } });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!targetUser) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    const newRole = await prisma.role.findUnique({ where: { id: roleId } });
    if (!newRole) {
      return res.status(404).json({ success: false, error: { message: 'Role not found' } });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });

    await logAudit(req, 'USER_ROLE_CHANGE', {
      targetUserId: userId,
      oldRole: targetUser.role.name,
      newRole: newRole.name,
    });

    return res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
