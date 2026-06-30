import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';

// Start a timer
export const startTimer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, description } = req.body;
    const userId = req.user!.id;

    if (!taskId) {
      return res.status(400).json({ success: false, error: { message: 'Task ID is required to start timer' } });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    // Check if there is an active timer already
    const activeTimer = await prisma.timeLog.findFirst({
      where: { userId, endTime: null },
    });

    if (activeTimer) {
      // Automatically stop active timer first
      const now = new Date();
      const diffMs = now.getTime() - activeTimer.startTime.getTime();
      const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

      await prisma.timeLog.update({
        where: { id: activeTimer.id },
        data: {
          endTime: now,
          durationMinutes,
        },
      });

      // Increment task hours
      await prisma.task.update({
        where: { id: activeTimer.taskId },
        data: {
          actualHours: { increment: parseFloat((durationMinutes / 60).toFixed(2)) },
        },
      });
    }

    const newTimer = await prisma.timeLog.create({
      data: {
        taskId,
        userId,
        description: description || 'Active timer started',
        startTime: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      data: newTimer,
    });
  } catch (error) {
    console.error('Error starting timer:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Stop active timer
export const stopTimer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const activeTimer = await prisma.timeLog.findFirst({
      where: { userId, endTime: null },
      include: { task: true },
    });

    if (!activeTimer) {
      return res.status(400).json({ success: false, error: { message: 'No active timer found running' } });
    }

    const now = new Date();
    const diffMs = now.getTime() - activeTimer.startTime.getTime();
    const durationMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

    const stoppedTimer = await prisma.timeLog.update({
      where: { id: activeTimer.id },
      data: {
        endTime: now,
        durationMinutes,
      },
    });

    // Increment task hours
    await prisma.task.update({
      where: { id: activeTimer.taskId },
      data: {
        actualHours: { increment: parseFloat((durationMinutes / 60).toFixed(2)) },
      },
    });

    await logAudit(req, 'TIME_LOG_STOP', { taskId: activeTimer.taskId, durationMinutes });

    return res.json({
      success: true,
      data: stoppedTimer,
    });
  } catch (error) {
    console.error('Error stopping timer:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Log manual time entry
export const logManualTime = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskId, durationMinutes, description, date } = req.body;
    const userId = req.user!.id;

    if (!taskId || !durationMinutes) {
      return res.status(400).json({ success: false, error: { message: 'Task ID and durationMinutes are required' } });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ success: false, error: { message: 'Task not found' } });

    const startTime = date ? new Date(date) : new Date();
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const log = await prisma.timeLog.create({
      data: {
        taskId,
        userId,
        description,
        startTime,
        endTime,
        durationMinutes: parseInt(durationMinutes),
      },
    });

    // Increment task hours
    await prisma.task.update({
      where: { id: taskId },
      data: {
        actualHours: { increment: parseFloat((durationMinutes / 60).toFixed(2)) },
      },
    });

    await logAudit(req, 'TIME_LOG_MANUAL', { taskId, durationMinutes });

    return res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('Error logging manual time:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Get time logs (with query filters)
export const getTimeLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { taskId } = req.query;

    const whereClause: any = { userId };
    if (taskId) whereClause.taskId = taskId as string;

    const logs = await prisma.timeLog.findMany({
      where: whereClause,
      include: {
        task: {
          select: { id: true, title: true, taskIndex: true, project: { select: { name: true } } },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error('Error fetching time logs:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Get currently running timer
export const getActiveTimer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const activeTimer = await prisma.timeLog.findFirst({
      where: { userId, endTime: null },
      include: {
        task: { select: { id: true, title: true, taskIndex: true } },
      },
    });

    return res.json({
      success: true,
      data: activeTimer || null,
    });
  } catch (error) {
    console.error('Error fetching active timer:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
