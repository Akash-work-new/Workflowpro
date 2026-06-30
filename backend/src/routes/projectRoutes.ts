import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
  getProjectStatistics,
  createSprint,
  getSprints,
  updateSprint,
  deleteSprint,
} from '../controllers/projectController';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';

const router = Router();

// Project routes
router.post('/', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), createProject);
router.get('/', requireAuth, getProjects);
router.get('/:id', requireAuth, getProjectById);
router.put('/:id', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), updateProject);
router.delete('/:id', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN']), deleteProject);
router.get('/:id/statistics', requireAuth, getProjectStatistics);

// Sprint routes nested inside projects
router.post('/:projectId/sprints', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), createSprint);
router.get('/:projectId/sprints', requireAuth, getSprints);

// Independent sprint modification
router.put('/sprints/:id', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), updateSprint);
router.delete('/sprints/:id', requireAuth, requireRole(['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD']), deleteSprint);

export default router;
