import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  updateStatus,
  listUsers,
  updateUserRole,
} from '../controllers/userController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.put('/status', requireAuth, updateStatus);

// Management routes
router.get('/', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), listUsers);
router.put('/:userId/role', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), updateUserRole);

export default router;
