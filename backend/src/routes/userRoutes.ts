import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateStatus,
  listUsers,
  updateUserRole,
  createUser,
  deleteUser,
  updateUserStatus,
  getRoles,
  getDepartments,
  factoryReset,
} from '../controllers/userController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

// ── Self-service routes ──────────────────────────────────────────────────────
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.put('/status', requireAuth, updateStatus);

// ── Lookup routes (all authed staff) ────────────────────────────────────────
router.get('/roles', requireAuth, getRoles);
router.get('/departments', requireAuth, getDepartments);

// ── User management (Admin+) ─────────────────────────────────────────────────
router.get('/', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), listUsers);
router.put('/:userId/role', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), updateUserRole);
router.put('/:userId/status', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), updateUserStatus);

// ── Super Admin and Admin ────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), createUser);
router.delete('/:userId', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), deleteUser);

// ── Super Admin only ─────────────────────────────────────────────────────────
router.post('/admin/factory-reset', requireAuth, requireRole(['SUPER_ADMIN']), factoryReset);

export default router;
