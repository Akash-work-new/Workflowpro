import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';

// ==========================================
// PROJECT CONTROLLERS
// ==========================================

// Create Project (Admin / Super Admin only)
export const createProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, departmentId, projectManagerId, startDate, endDate, customStatuses } = req.body;

    if (!name || !departmentId || !projectManagerId || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: { message: 'Missing required project fields' } });
    }

    // Verify manager exists
    const manager = await prisma.user.findUnique({ where: { id: projectManagerId } });
    if (!manager) {
      return res.status(400).json({ success: false, error: { message: 'Project Manager user not found' } });
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        departmentId,
        projectManagerId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        customStatuses: customStatuses ? JSON.stringify(customStatuses) : JSON.stringify([]),
      },
    });

    await logAudit(req, 'PROJECT_CREATION', { projectId: newProject.id, name: newProject.name });

    return res.status(201).json({
      success: true,
      data: newProject,
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Fetch Projects list (RBAC department filters)
export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ success: false, error: { message: 'Unauthorized' } });

    let projects;

    if (user.role.name === 'SUPER_ADMIN') {
      // Super Admin sees all
      projects = await prisma.project.findMany({
        include: { department: true, projectManager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } else if (user.role.name === 'ADMIN' && user.departmentId) {
      // Admin sees their department projects
      projects = await prisma.project.findMany({
        where: { departmentId: user.departmentId },
        include: { department: true, projectManager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Leads/Agents see their department projects or projects they manage
      const deptId = user.departmentId || undefined;
      projects = await prisma.project.findMany({
        where: {
          OR: [
            { departmentId: deptId },
            { projectManagerId: user.id },
          ],
        },
        include: { department: true, projectManager: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return res.json({
      success: true,
      data: projects.map((p) => {
        let customStatuses = [];
        try {
          customStatuses = JSON.parse(p.customStatuses);
        } catch {
          customStatuses = [];
        }
        return { ...p, customStatuses };
      }),
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Fetch Project by ID
export const getProjectById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        department: true,
        projectManager: { select: { id: true, name: true, email: true } },
        sprints: true,
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true, profilePhoto: true } },
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    }

    let customStatuses = [];
    try {
      customStatuses = JSON.parse(project.customStatuses);
    } catch {
      customStatuses = [];
    }

    return res.json({
      success: true,
      data: { ...project, customStatuses },
    });
  } catch (error) {
    console.error('Error fetching project detail:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Update Project
export const updateProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, status, projectManagerId, startDate, endDate, customStatuses } = req.body;

    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    }

    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (description !== undefined) updatedData.description = description;
    if (status) updatedData.status = status;
    if (projectManagerId) updatedData.projectManagerId = projectManagerId;
    if (startDate) updatedData.startDate = new Date(startDate);
    if (endDate) updatedData.endDate = new Date(endDate);
    if (customStatuses) updatedData.customStatuses = JSON.stringify(customStatuses);

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updatedData,
    });

    await logAudit(req, 'PROJECT_UPDATE', { projectId: id, updatedFields: Object.keys(updatedData) });

    return res.json({
      success: true,
      data: updatedProject,
    });
  } catch (error) {
    console.error('Error updating project:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Delete Project
export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    }

    await prisma.project.delete({ where: { id } });
    await logAudit(req, 'PROJECT_DELETION', { projectId: id, name: project.name });

    return res.json({
      success: true,
      data: { message: 'Project deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Project Statistics
export const getProjectStatistics = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const tasks = await prisma.task.findMany({
      where: { projectId: id },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
    const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CLOSED' && t.status !== 'CANCELLED').length;
    
    const now = new Date();
    const overdueTasks = tasks.filter(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CLOSED' &&
        t.status !== 'CANCELLED' &&
        t.dueDate &&
        new Date(t.dueDate) < now
    ).length;

    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return res.json({
      success: true,
      data: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionPercentage,
      },
    });
  } catch (error) {
    console.error('Error generating project statistics:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ==========================================
// SPRINT CONTROLLERS
// ==========================================

// Create Sprint
export const createSprint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, startDate, endDate } = req.body;

    if (!name || !startDate || !endDate) {
      return res.status(400).json({ success: false, error: { message: 'Missing sprint parameters' } });
    }

    const projectExists = await prisma.project.findUnique({ where: { id: projectId } });
    if (!projectExists) {
      return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    }

    const newSprint = await prisma.sprint.create({
      data: {
        name,
        projectId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'PLANNING',
      },
    });

    await logAudit(req, 'SPRINT_CREATION', { sprintId: newSprint.id, name: newSprint.name });

    return res.status(201).json({
      success: true,
      data: newSprint,
    });
  } catch (error) {
    console.error('Error creating sprint:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Fetch Project Sprints
export const getSprints = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId } = req.params;

    const sprints = await prisma.sprint.findMany({
      where: { projectId },
      include: { tasks: true },
      orderBy: { startDate: 'asc' },
    });

    return res.json({
      success: true,
      data: sprints,
    });
  } catch (error) {
    console.error('Error fetching sprints:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Update Sprint Status / Metadata
export const updateSprint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, status } = req.body;

    const existingSprint = await prisma.sprint.findUnique({ where: { id } });
    if (!existingSprint) {
      return res.status(404).json({ success: false, error: { message: 'Sprint not found' } });
    }

    const updatedData: any = {};
    if (name) updatedData.name = name;
    if (startDate) updatedData.startDate = new Date(startDate);
    if (endDate) updatedData.endDate = new Date(endDate);
    if (status) updatedData.status = status;

    // Auto-complete tasks inside completed sprints (Optional logic: let status stay, but here we just update sprint status)
    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: updatedData,
    });

    await logAudit(req, 'SPRINT_UPDATE', { sprintId: id, status: status || existingSprint.status });

    return res.json({
      success: true,
      data: updatedSprint,
    });
  } catch (error) {
    console.error('Error updating sprint:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Delete Sprint
export const deleteSprint = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const sprint = await prisma.sprint.findUnique({ where: { id } });
    if (!sprint) {
      return res.status(404).json({ success: false, error: { message: 'Sprint not found' } });
    }

    await prisma.sprint.delete({ where: { id } });
    await logAudit(req, 'SPRINT_DELETION', { sprintId: id, name: sprint.name });

    return res.json({
      success: true,
      data: { message: 'Sprint deleted successfully' },
    });
  } catch (error) {
    console.error('Error deleting sprint:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
