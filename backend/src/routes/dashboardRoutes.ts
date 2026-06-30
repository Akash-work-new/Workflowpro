import { Router } from 'express';
import {
  getAdminDashboard,
  getEmployeeDashboard,
  getLeaderboard,
} from '../controllers/dashboardController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.get('/admin', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), getAdminDashboard);
router.get('/employee/:userId', requireAuth, getEmployeeDashboard);
router.get('/employee', requireAuth, getEmployeeDashboard); // Current user shortcut
router.get('/leaderboard', requireAuth, getLeaderboard);

export default router;
