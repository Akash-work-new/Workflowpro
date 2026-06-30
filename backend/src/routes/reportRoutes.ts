import { Router } from 'express';
import { exportReport } from '../controllers/reportController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.get('/export', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), exportReport);

export default router;
