import { Router } from 'express';
import {
  startTimer,
  stopTimer,
  logManualTime,
  getTimeLogs,
  getActiveTimer,
} from '../controllers/timeController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.post('/start', requireAuth, startTimer);
router.post('/stop', requireAuth, stopTimer);
router.post('/manual', requireAuth, logManualTime);
router.get('/', requireAuth, getTimeLogs);
router.get('/active', requireAuth, getActiveTimer);

export default router;
