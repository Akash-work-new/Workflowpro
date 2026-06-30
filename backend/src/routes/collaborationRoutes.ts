import { Router } from 'express';
import {
  addComment,
  uploadAttachment,
  deleteAttachment,
} from '../controllers/collaborationController';
import { requireAuth } from '../middleware/authMiddleware';
import { upload } from '../middleware/uploadMiddleware';

const router = Router();

// Nested under tasks
router.post('/tasks/:id/comments', requireAuth, addComment);
router.post('/tasks/:id/attachments', requireAuth, upload.single('file'), uploadAttachment);

// Independent attachment removal
router.delete('/attachments/:attachmentId', requireAuth, deleteAttachment);

export default router;
