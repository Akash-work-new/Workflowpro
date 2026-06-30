import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  approveTask,
  bulkUpdateTasks,
} from '../controllers/taskController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.post('/', requireAuth, createTask);
router.get('/', requireAuth, getTasks);
router.get('/:id', requireAuth, getTaskById);
router.put('/:id', requireAuth, updateTask);

// Approvals & Reviews (Only leads and admins)
router.post('/:id/approval', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), approveTask);

// Bulk updates
router.post('/bulk-update', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), bulkUpdateTasks);

export default router;
