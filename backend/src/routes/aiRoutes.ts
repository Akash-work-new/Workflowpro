import { Router } from 'express';
import {
  getAiSubtasks,
  getAiEstimate,
  predictTaskDelay,
  suggestTaskAssignee,
  generateWeeklyDigest,
  draftPerformanceReview,
} from '../controllers/aiController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

router.post('/task/subtasks', requireAuth, getAiSubtasks);
router.post('/task/estimate', requireAuth, getAiEstimate);
router.post('/task/delay-prediction', requireAuth, predictTaskDelay);
router.post('/task/suggest-assignee', requireAuth, suggestTaskAssignee);

// Executive/Management features
router.post('/reports/weekly', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), generateWeeklyDigest);
router.post('/performance/review', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), draftPerformanceReview);

export default router;
