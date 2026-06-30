import { Response } from 'express';
import * as aiService from '../services/aiService';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// Generate Subtasks from Title
export const getAiSubtasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: { message: 'Title is required' } });
    }

    const subtasks = await aiService.generateSubtasks(title, description || '');
    return res.json({
      success: true,
      data: subtasks,
    });
  } catch (error) {
    console.error('AI controller subtasks error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to generate subtasks' } });
  }
};

// Estimate Completion hours
export const getAiEstimate = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, priority } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: { message: 'Title is required' } });
    }

    const estimate = await aiService.estimateCompletionTime(title, description || '', priority || 'MEDIUM');
    return res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    console.error('AI controller estimate error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to generate estimate' } });
  }
};

// Predict Delay for a specific task
export const predictTaskDelay = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: { message: 'Task ID is required' } });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { assignedTo: true },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    // Calculate current workload of assignee
    let workloadHours = 0;
    if (task.assignedToId) {
      const assigneeTasks = await prisma.task.findMany({
        where: {
          assignedToId: task.assignedToId,
          status: { in: ['IN_PROGRESS', 'WAITING_FOR_REVIEW', 'OPEN'] },
        },
      });
      workloadHours = assigneeTasks.reduce((acc, t) => acc + (t.estimatedHours || 8.0), 0);
    }

    const prediction = await aiService.predictDelays(
      { title: task.title, priority: task.priority, dueDate: task.dueDate },
      workloadHours
    );

    return res.json({
      success: true,
      data: prediction,
    });
  } catch (error) {
    console.error('AI delay prediction error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to predict delays' } });
  }
};

// Suggest Assignee from project candidates
export const suggestTaskAssignee = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, priority, projectId } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ success: false, error: { message: 'Title and Project ID are required' } });
    }

    // Get all users in the project department
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ success: false, error: { message: 'Project not found' } });

    const candidates = await prisma.user.findMany({
      where: {
        departmentId: project.departmentId,
        status: { not: 'INACTIVE' },
      },
    });

    if (candidates.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'No candidates available in project department' } });
    }

    // Compile active workload hours for each candidate
    const candidateProfiles = [];
    for (const c of candidates) {
      const activeTasks = await prisma.task.findMany({
        where: {
          assignedToId: c.id,
          status: { in: ['IN_PROGRESS', 'WAITING_FOR_REVIEW', 'OPEN'] },
        },
      });
      const activeWorkloadHours = activeTasks.reduce((acc, t) => acc + (t.estimatedHours || 8.0), 0);
      candidateProfiles.push({
        id: c.id,
        name: c.name,
        designation: c.designation,
        activeWorkloadHours,
      });
    }

    const choice = await aiService.suggestAssignee(
      { title, description: description || '', priority: priority || 'MEDIUM' },
      candidateProfiles
    );

    return res.json({
      success: true,
      data: choice,
    });
  } catch (error) {
    console.error('AI suggest assignee error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to suggest assignee' } });
  }
};

// Generate Weekly Report
export const generateWeeklyDigest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.body;
    const targetUserId = userId || req.user!.id;

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found' } });

    // Fetch time logs for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const logs = await prisma.timeLog.findMany({
      where: {
        userId: targetUserId,
        startTime: { gte: sevenDaysAgo },
      },
      include: { task: true },
    });

    const formattedLogs = logs.map((l) => ({
      durationMinutes: l.durationMinutes,
      description: l.description || 'Logged work hours',
      taskTitle: l.task.title,
    }));

    const digest = await aiService.generateWeeklyReport(user.name, formattedLogs);

    return res.json({
      success: true,
      data: digest,
    });
  } catch (error) {
    console.error('AI weekly report error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to generate weekly digest' } });
  }
};

// Generate Performance Review Draft
export const draftPerformanceReview = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { employeeId, managerFeedback } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, error: { message: 'Employee ID is required' } });
    }

    const user = await prisma.user.findUnique({ where: { id: employeeId } });
    if (!user) return res.status(404).json({ success: false, error: { message: 'Employee not found' } });

    // Compile task stats
    const tasks = await prisma.task.findMany({ where: { assignedToId: employeeId } });
    const completed = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
    const total = tasks.length;
    
    const now = new Date();
    const overdue = tasks.filter(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CLOSED' &&
        t.status !== 'CANCELLED' &&
        t.dueDate &&
        new Date(t.dueDate) < now
    ).length;

    // Productivity Score = completed ratio * 100
    const productivity = total > 0 ? (completed / total) * 100 : 100;
    
    // On-Time completion percent
    const onTimeTasks = tasks.filter(
      (t) =>
        (t.status === 'COMPLETED' || t.status === 'CLOSED') &&
        t.dueDate &&
        t.updatedAt <= t.dueDate
    ).length;
    const onTimePercent = completed > 0 ? (onTimeTasks / completed) * 100 : 100;

    const stats = {
      name: user.name,
      completed,
      overdue,
      productivity: Math.round(productivity),
      efficiency: Math.round(productivity), // mapped to productivity ratio for simplicity in dev
      onTimePercent: Math.round(onTimePercent),
    };

    const review = await aiService.generatePerformanceReview(stats, managerFeedback || '');

    return res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    console.error('AI draft performance review error:', error);
    return res.status(500).json({ success: false, error: { message: 'Failed to generate performance scorecard' } });
  }
};
