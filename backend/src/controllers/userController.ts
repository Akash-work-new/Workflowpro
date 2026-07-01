import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';
import bcrypt from 'bcryptjs';

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
      data: { name, phoneNumber, profilePhoto, designation },
      include: { role: true },
    });

    await logAudit(req, 'USER_UPDATE_PROFILE', {
      updatedFields: { name, phoneNumber, profilePhoto, designation },
    });

    return res.json({ success: true, data: updatedUser });
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

    return res.json({ success: true, data: { id: updatedUser.id, status: updatedUser.status } });
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
    if (role) whereClause.role = { name: role as string };

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        role: true,
        department: true,
        manager: { select: { id: true, name: true, designation: true } },
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
        return { ...u, role: { ...u.role, permissions } };
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

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!targetUser) return res.status(404).json({ success: false, error: { message: 'User not found' } });

    const newRole = await prisma.role.findUnique({ where: { id: roleId } });
    if (!newRole) return res.status(404).json({ success: false, error: { message: 'Role not found' } });

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

    return res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating role:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Create a new user ──────────────────────────────────────────
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, roleName, designation, departmentId, phoneNumber } = req.body;

    if (!name || !email || !password || !roleName || !designation) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, email, password, roleName and designation are required.' },
      });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Email already in use.' } });
    }

    // Resolve role
    const role = await prisma.role.findFirst({ where: { name: roleName } });
    if (!role) {
      return res.status(400).json({ success: false, error: { message: `Role '${roleName}' not found.` } });
    }

    // Generate unique employee ID
    const count = await prisma.user.count();
    const employeeId = `EMP${String(count + 1).padStart(4, '0')}`;

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        employeeId,
        designation,
        roleId: role.id,
        departmentId: departmentId || null,
        phoneNumber: phoneNumber || null,
        status: 'ACTIVE',
      },
      include: { role: true, department: true },
    });

    await logAudit(req, 'USER_CREATED', {
      createdUserId: newUser.id,
      name,
      email,
      role: roleName,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: newUser.id,
        employeeId: newUser.employeeId,
        name: newUser.name,
        email: newUser.email,
        designation: newUser.designation,
        status: newUser.status,
        role: newUser.role.name,
        department: newUser.department?.name || null,
      },
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Delete a user ──────────────────────────────────────────────
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const requesterId = req.user?.id;

    if (userId === requesterId) {
      return res.status(400).json({ success: false, error: { message: 'You cannot delete your own account.' } });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, include: { role: true } });
    if (!target) return res.status(404).json({ success: false, error: { message: 'User not found.' } });

    // Prevent deleting another SUPER_ADMIN
    if (target.role.name === 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, error: { message: 'Cannot delete another Super Admin.' } });
    }

    await prisma.user.delete({ where: { id: userId } });

    await logAudit(req, 'USER_DELETED', { deletedUserId: userId, deletedName: target.name, deletedEmail: target.email });

    return res.json({ success: true, data: { message: `User ${target.name} deleted successfully.` } });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Update user status (activate / deactivate) ─────────────────
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    const validStatuses = ['ACTIVE', 'INACTIVE', 'ON_LEAVE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid status.' } });
    }

    const updated = await prisma.user.update({ where: { id: userId }, data: { status }, include: { role: true } });

    await logAudit(req, 'USER_STATUS_CHANGED', { targetUserId: userId, newStatus: status });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating user status:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Get all available roles ────────────────────────────────────
export const getRoles = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, data: roles });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Get all departments ────────────────────────────────────────
export const getDepartments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });
    return res.json({ success: true, data: departments });
  } catch (error) {
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ─── SUPER ADMIN: Factory Reset — wipe all operational data ──────────────────
export const factoryReset = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { confirmationPhrase } = req.body;
    const requesterId = req.user?.id;

    if (confirmationPhrase !== 'RESET ALL DATA') {
      return res.status(400).json({
        success: false,
        error: { message: 'Confirmation phrase does not match. Type exactly: RESET ALL DATA' },
      });
    }

    // Wipe all operational data in the correct order to respect FK constraints
    await prisma.aiAnalysis.deleteMany({});
    await prisma.savedFilter.deleteMany({});
    await prisma.notification.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.performanceReview.deleteMany({});
    await prisma.performanceGoal.deleteMany({});
    await prisma.timeLog.deleteMany({});
    await prisma.taskAttachment.deleteMany({});
    await prisma.taskComment.deleteMany({});
    await prisma.taskWatcher.deleteMany({});
    await prisma.taskChecklist.deleteMany({});
    await prisma.taskDependency.deleteMany({});
    await prisma.taskHistory.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.sprint.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.teamMember.deleteMany({});
    await prisma.team.deleteMany({});

    // Delete all users EXCEPT the requesting Super Admin
    await prisma.user.deleteMany({ where: { id: { not: requesterId! } } });

    // Keep departments and roles intact (structural data)

    await logAudit(req, 'FACTORY_RESET', {
      performedBy: req.user?.id,
      timestamp: new Date().toISOString(),
      note: 'All operational data wiped. Roles and requesting Super Admin account preserved.',
    });

    return res.json({
      success: true,
      data: {
        message: 'Factory reset complete. All operational data has been wiped. Your account and system roles are preserved.',
      },
    });
  } catch (error) {
    console.error('Factory reset error:', error);
    return res.status(500).json({ success: false, error: { message: 'Factory reset failed. Please try again.' } });
  }
};
