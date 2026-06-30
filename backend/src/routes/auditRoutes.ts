import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.get('/', requireAuth, requireRole(['SUPER_ADMIN']), getAuditLogs);

export default router;
