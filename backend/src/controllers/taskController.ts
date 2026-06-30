import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';

// Helper to push task history entry
export const pushTaskHistory = async (taskId: string, userId: string, event: string, oldValue: string | null, newValue: string | null, details: string | null) => {
  await prisma.taskHistory.create({
    data: {
      taskId,
      userId,
      event,
      oldValue,
      newValue,
      details,
    },
  });
};

// Create Task
export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, description, priority, category, projectId, sprintId, assignedToId, startDate, dueDate, estimatedHours, tags, customFields, dependencies, isRevenueImpacting } = req.body;

    if (!title || !projectId) {
      return res.status(400).json({ success: false, error: { message: 'Title and Project ID are required' } });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    }

    const taskCount = await prisma.task.count({ where: { projectId } });
    const taskIndex = taskCount + 1;

    const task = await prisma.task.create({
      data: {
        taskIndex,
        title,
        description,
        priority: priority || 'MEDIUM',
        category: category || 'Task',
        status: 'BACKLOG',
        projectId,
        sprintId: sprintId || null,
        assignedById: req.user!.id,
        assignedToId: assignedToId || null,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        estimatedHours: estimatedHours ? parseFloat(estimatedHours) : null,
        tags: tags ? JSON.stringify(tags) : JSON.stringify([]),
        customFields: customFields ? JSON.stringify(customFields) : JSON.stringify({}),
        isRevenueImpacting: !!isRevenueImpacting,
      },
    });

    // Write History
    await pushTaskHistory(task.id, req.user!.id, 'CREATED', null, 'Task Created', 'Task initialized');

    // Create Dependencies
    if (dependencies && Array.isArray(dependencies)) {
      for (const dependsOnTaskId of dependencies) {
        await prisma.taskDependency.create({
          data: {
            dependentTaskId: task.id,
            dependsOnTaskId,
          },
        });
      }
    }

    // Push notification to assignee
    if (assignedToId) {
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          title: 'New Task Assigned',
          message: `You have been assigned: ${project.name}-${taskIndex}: ${title}`,
          type: 'TASK_ASSIGNED',
        },
      });
    }

    await logAudit(req, 'TASK_CREATION', { taskId: task.id, title: task.title });

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Fetch Tasks List (with query filters)
export const getTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { projectId, sprintId, assignedToId, status, priority, search } = req.query;

    const whereClause: any = {};
    if (projectId) whereClause.projectId = projectId as string;
    if (sprintId) whereClause.sprintId = sprintId as string;
    if (assignedToId) whereClause.assignedToId = assignedToId as string;
    if (status) whereClause.status = status as string;
    if (priority) whereClause.priority = priority as string;

    if (search) {
      whereClause.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        assignedTo: { select: { id: true, name: true, profilePhoto: true } },
        assignedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        sprint: { select: { id: true, name: true } },
      },
      orderBy: { taskIndex: 'asc' },
    });

    return res.json({
      success: true,
      data: tasks.map((t) => {
        let parsedTags = [];
        try {
          parsedTags = JSON.parse(t.tags);
        } catch {
          parsedTags = [];
        }

        let parsedCustomFields = {};
        try {
          parsedCustomFields = t.customFields ? JSON.parse(t.customFields as string) : {};
        } catch {
          parsedCustomFields = {};
        }

        return {
          ...t,
          tags: parsedTags,
          customFields: parsedCustomFields,
        };
      }),
    });
  } catch (error) {
    console.error('Error listing tasks:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Fetch Task by ID
export const getTaskById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true, profilePhoto: true } },
        assignedBy: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, customStatuses: true } },
        sprint: { select: { id: true, name: true } },
        comments: {
          include: {
            user: { select: { id: true, name: true, profilePhoto: true } },
            replies: {
              include: { user: { select: { id: true, name: true, profilePhoto: true } } },
            },
          },
          where: { parentId: null }, // thread roots
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: { user: { select: { id: true, name: true } } },
        },
        timeLogs: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
        histories: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { timestamp: 'desc' },
        },
        checklists: true,
        dependencies: {
          include: { dependsOnTask: { select: { id: true, title: true, status: true, taskIndex: true } } },
        },
        blockedBy: {
          include: { dependentTask: { select: { id: true, title: true, status: true, taskIndex: true } } },
        },
        watchers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    let parsedTags = [];
    try {
      parsedTags = JSON.parse(task.tags);
    } catch {
      parsedTags = [];
    }

    let parsedCustomFields = {};
    try {
      parsedCustomFields = task.customFields ? JSON.parse(task.customFields as string) : {};
    } catch {
      parsedCustomFields = {};
    }

    return res.json({
      success: true,
      data: {
        ...task,
        tags: parsedTags,
        customFields: parsedCustomFields,
      },
    });
  } catch (error) {
    console.error('Error fetching task details:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Update Task
export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, status, sprintId, assignedToId, startDate, dueDate, estimatedHours, actualHours, tags, customFields, isRevenueImpacting } = req.body;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    // RBAC: Agents can only update tasks assigned to or created by them
    if (req.user!.role.name === 'AGENT' && task.assignedToId !== req.user!.id && task.assignedById !== req.user!.id) {
      return res.status(403).json({ success: false, error: { message: 'Agents can only edit tasks assigned to or created by them.' } });
    }

    const updatedData: any = {};
    if (title) updatedData.title = title;
    if (description !== undefined) updatedData.description = description;
    if (priority) updatedData.priority = priority;
    if (category) updatedData.category = category;
    if (sprintId !== undefined) updatedData.sprintId = sprintId;
    if (assignedToId !== undefined) updatedData.assignedToId = assignedToId;
    if (startDate) updatedData.startDate = new Date(startDate);
    if (dueDate) updatedData.dueDate = new Date(dueDate);
    if (estimatedHours !== undefined) updatedData.estimatedHours = parseFloat(estimatedHours);
    if (actualHours !== undefined) updatedData.actualHours = parseFloat(actualHours);
    if (tags) updatedData.tags = JSON.stringify(tags);
    if (customFields) updatedData.customFields = JSON.stringify(customFields);
    if (isRevenueImpacting !== undefined) updatedData.isRevenueImpacting = !!isRevenueImpacting;

    // Check dependencies if transitioning status towards in-progress or closed
    if (status && status !== task.status) {
      const activeState = ['IN_PROGRESS', 'WAITING_FOR_REVIEW', 'COMPLETED'];
      if (activeState.includes(status)) {
        // Find blocking tasks
        const blocks = await prisma.taskDependency.findMany({
          where: { dependentTaskId: id },
          include: { dependsOnTask: true },
        });

        const unresolved = blocks.filter(
          (b) => b.dependsOnTask.status !== 'COMPLETED' && b.dependsOnTask.status !== 'CLOSED'
        );

        if (unresolved.length > 0) {
          const names = unresolved.map((u) => `${u.dependsOnTask.title} (${u.dependsOnTask.status})`).join(', ');
          return res.status(400).json({
            success: false,
            error: {
              code: 'BLOCKED_BY_DEPENDENCY',
              message: `Cannot transition task state. Blocked by unfinished tasks: ${names}`,
            },
          });
        }
      }

      // Task Approval Workflow:
      // If Agent completes task (sets to COMPLETED or CLOSED), change status to Completed Pending Approval (WAITING_FOR_REVIEW)
      if (req.user!.role.name === 'AGENT' && (status === 'COMPLETED' || status === 'CLOSED')) {
        updatedData.status = 'WAITING_FOR_REVIEW';
        
        // Notify Team Leads / Project Managers
        const managerId = req.user!.managerId;
        if (managerId) {
          await prisma.notification.create({
            data: {
              userId: managerId,
              title: 'Task Pending Approval',
              message: `${req.user!.name} requested completion approval for task: ${task.title}`,
              type: 'TASK_UPDATED',
            },
          });
        }
      } else {
        updatedData.status = status;
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updatedData,
    });

    // Write histories
    if (status && status !== task.status) {
      await pushTaskHistory(id, req.user!.id, 'STATUS_CHANGED', task.status, updatedTask.status, `Transitioned status`);
    }

    if (assignedToId && assignedToId !== task.assignedToId) {
      await pushTaskHistory(id, req.user!.id, 'ASSIGNED', task.assignedToId, assignedToId, `Assigned to user`);
      // Notify new assignee
      await prisma.notification.create({
        data: {
          userId: assignedToId,
          title: 'Task Reassigned',
          message: `You have been assigned: ${task.title}`,
          type: 'TASK_ASSIGNED',
        },
      });
    }

    await pushTaskHistory(id, req.user!.id, 'UPDATED', null, null, `Metadata updated`);
    await logAudit(req, 'TASK_UPDATE', { taskId: id, title: task.title, status: status || task.status });

    return res.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Approve / Reject Task Completion (Lead / Admin only)
export const approveTask = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, rejectionReason } = req.body;

    const task = await prisma.task.findUnique({ where: { id } });
    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    if (task.status !== 'WAITING_FOR_REVIEW') {
      return res.status(400).json({ success: false, error: { message: 'Task is not pending approval review' } });
    }

    let finalStatus: string;
    let eventName: string;

    if (approved) {
      finalStatus = 'COMPLETED';
      eventName = 'COMPLETED';
    } else {
      if (!rejectionReason) {
        return res.status(400).json({ success: false, error: { message: 'Rejection reason required when rejecting completion request' } });
      }
      finalStatus = 'IN_PROGRESS';
      eventName = 'REJECTED';
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: finalStatus,
        rejectionReason: approved ? null : rejectionReason,
      },
    });

    await pushTaskHistory(
      id,
      req.user!.id,
      eventName,
      'WAITING_FOR_REVIEW',
      finalStatus,
      approved ? 'Completion approved' : `Completion rejected: ${rejectionReason}`
    );

    // Notify assignee
    if (task.assignedToId) {
      await prisma.notification.create({
        data: {
          userId: task.assignedToId,
          title: approved ? 'Task Approved' : 'Task Completion Rejected',
          message: approved
            ? `Your task completion request was approved: ${task.title}`
            : `Your task completion request was rejected: ${task.title}. Reason: ${rejectionReason}`,
          type: approved ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        },
      });
    }

    await logAudit(req, approved ? 'TASK_APPROVAL_APPROVE' : 'TASK_APPROVAL_REJECT', { taskId: id });

    return res.json({
      success: true,
      data: updatedTask,
    });
  } catch (error) {
    console.error('Error processing task approval:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Bulk Update Tasks
export const bulkUpdateTasks = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { taskIds, status, sprintId, priority } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: { message: 'Task IDs array is required' } });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (sprintId !== undefined) updateData.sprintId = sprintId;
    if (priority) updateData.priority = priority;

    const updatedTasksCount = await prisma.task.updateMany({
      where: { id: { in: taskIds } },
      data: updateData,
    });

    // Write histories and audit logs
    for (const taskId of taskIds) {
      await pushTaskHistory(
        taskId,
        req.user!.id,
        'UPDATED',
        null,
        null,
        `Bulk updated: ${Object.keys(updateData).join(', ')}`
      );
    }

    await logAudit(req, 'TASK_BULK_UPDATE', { count: updatedTasksCount.count, taskIds });

    return res.json({
      success: true,
      data: { count: updatedTasksCount.count },
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
