import { Response } from 'express';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// ==========================================
// ADMIN DASHBOARD
// ==========================================
export const getAdminDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    
    // Admin is scoped to their department, Super Admin is global
    const deptId = user.role.name === 'ADMIN' ? user.departmentId : (req.query.departmentId as string || null);

    // Filters based on department
    const taskFilter: any = {};
    const projectFilter: any = {};
    const userFilter: any = {};

    if (deptId) {
      taskFilter.project = { departmentId: deptId };
      projectFilter.departmentId = deptId;
      userFilter.departmentId = deptId;
    }

    // 1. Open Tickets / Tasks count
    const openTicketsCount = await prisma.task.count({
      where: {
        ...taskFilter,
        status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
      },
    });

    // 2. Revenue Impacting Tasks
    const revenueTasks = await prisma.task.findMany({
      where: {
        ...taskFilter,
        isRevenueImpacting: true,
        status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
      },
      include: {
        assignedTo: { select: { id: true, name: true, profilePhoto: true } },
        project: { select: { id: true, name: true } },
      },
    });

    // 3. Delayed Projects
    const now = new Date();
    const delayedProjects = await prisma.project.findMany({
      where: {
        ...projectFilter,
        endDate: { lt: now },
        status: { not: 'COMPLETED' },
      },
      include: {
        projectManager: { select: { id: true, name: true } },
      },
    });

    // 4. Team Productivity (Average completion percentage of tasks in active projects)
    const projects = await prisma.project.findMany({
      where: projectFilter,
      include: {
        tasks: true,
      },
    });

    const teamProductivity = projects.map((p) => {
      const total = p.tasks.length;
      const completed = p.tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        projectId: p.id,
        projectName: p.name,
        completionRate: percent,
      };
    });

    // 5. Workload Imbalance (Identify users with heavy workload)
    const employees = await prisma.user.findMany({
      where: {
        ...userFilter,
        status: { not: 'INACTIVE' },
        role: { name: 'AGENT' },
      },
      include: {
        assignedTasks: {
          where: { status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] } },
        },
      },
    });

    const workloadList = employees.map((emp) => {
      const activeTasksCount = emp.assignedTasks.length;
      const totalHoursAllocated = emp.assignedTasks.reduce(
        (acc, t) => acc + (t.estimatedHours || 8.0),
        0
      );
      return {
        userId: emp.id,
        userName: emp.name,
        designation: emp.designation,
        activeTasksCount,
        totalHoursAllocated,
        isOverloaded: totalHoursAllocated > 35, // Flag overload
      };
    });

    // 6. Agent Rankings
    const allCompletedTasks = await prisma.task.findMany({
      where: {
        ...taskFilter,
        status: { in: ['COMPLETED', 'CLOSED'] },
      },
    });

    const agentRankings = employees.map((emp) => {
      const completedTasks = allCompletedTasks.filter((t) => t.assignedToId === emp.id);
      const onTimeCompletions = completedTasks.filter((t) => t.dueDate && t.updatedAt <= t.dueDate);
      
      const onTimeRate = completedTasks.length > 0
        ? Math.round((onTimeCompletions.length / completedTasks.length) * 100)
        : 100;

      // Ranking score calculation formula
      const score = (completedTasks.length * 10) + (onTimeRate * 0.5);

      return {
        userId: emp.id,
        userName: emp.name,
        profilePhoto: emp.profilePhoto,
        completedCount: completedTasks.length,
        onTimeRate,
        score: Math.round(score),
      };
    }).sort((a, b) => b.score - a.score);

    return res.json({
      success: true,
      data: {
        openTickets: openTicketsCount,
        revenueImpactingTasks: revenueTasks,
        delayedProjects,
        teamProductivity,
        workloadImbalance: workloadList,
        agentRankings,
      },
    });
  } catch (error) {
    console.error('Error fetching admin dashboard statistics:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ==========================================
// EMPLOYEE PERFORMANCE SCORECARD
// ==========================================
export const getEmployeeDashboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const targetUserId = userId || req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        department: true,
        manager: { select: { id: true, name: true, designation: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'Employee not found' } });
    }

    const tasks = await prisma.task.findMany({
      where: { assignedToId: targetUserId },
    });

    const assigned = tasks.length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
    const pending = tasks.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CLOSED' && t.status !== 'CANCELLED').length;
    
    const now = new Date();
    const overdue = tasks.filter(
      (t) =>
        t.status !== 'COMPLETED' &&
        t.status !== 'CLOSED' &&
        t.status !== 'CANCELLED' &&
        t.dueDate &&
        new Date(t.dueDate) < now
    ).length;

    // Time Log totals
    const timeLogs = await prisma.timeLog.findMany({ where: { userId: targetUserId } });
    const totalHoursLogged = parseFloat((timeLogs.reduce((acc, log) => acc + log.durationMinutes, 0) / 60).toFixed(1));

    // Average Task Completion Time (in hours)
    const completedTasks = tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED');
    let totalCompletionHours = 0;
    completedTasks.forEach((t) => {
      const durationMs = t.updatedAt.getTime() - t.createdAt.getTime();
      totalCompletionHours += durationMs / (1000 * 60 * 60);
    });

    const averageCompletionTime = completed > 0
      ? parseFloat((totalCompletionHours / completed).toFixed(1))
      : 0.0;

    // derived score calculations
    const productivityScore = assigned > 0 ? Math.round((completed / assigned) * 100) : 100;
    
    // On-Time Completion calculation
    const onTimeCompletions = completedTasks.filter((t) => t.dueDate && t.updatedAt <= t.dueDate).length;
    const onTimeRate = completed > 0 ? Math.round((onTimeCompletions / completed) * 100) : 100;

    // Efficiency Score (Estimated hours vs Actual hours ratio)
    const totalEstimated = completedTasks.reduce((acc, t) => acc + (t.estimatedHours || 0.0), 0.0);
    const totalActual = completedTasks.reduce((acc, t) => acc + t.actualHours, 0.0);
    const efficiencyScore = totalActual > 0 ? Math.round((totalEstimated / totalActual) * 100) : 100;

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          employeeId: user.employeeId,
          designation: user.designation,
          status: user.status,
          profilePhoto: user.profilePhoto,
          joiningDate: user.joiningDate,
          department: user.department?.name || 'Unassigned',
          managerName: user.manager?.name || 'N/A',
        },
        metrics: {
          tasksAssigned: assigned,
          tasksCompleted: completed,
          tasksPending: pending,
          tasksOverdue: overdue,
          totalHoursLogged,
          averageCompletionTimeHours: averageCompletionTime,
          averageResponseTimeHours: averageCompletionTime > 0 ? parseFloat((averageCompletionTime * 0.15).toFixed(1)) : 0.0, // Mock response offset
          productivityScore: Math.min(100, productivityScore),
          efficiencyScore: Math.min(100, efficiencyScore),
          taskCompletionRate: Math.min(100, productivityScore),
          onTimeCompletionPercentage: onTimeRate,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching employee scorecard metrics:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// ==========================================
// MONTHLY LEADERBOARD
// ==========================================
export const getLeaderboard = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { departmentId } = req.query;

    const userFilter: any = {
      status: { not: 'INACTIVE' },
      role: { name: 'AGENT' },
    };

    if (departmentId) {
      userFilter.departmentId = departmentId as string;
    }

    const agents = await prisma.user.findMany({
      where: userFilter,
      include: {
        assignedTasks: {
          where: { status: { in: ['COMPLETED', 'CLOSED'] } },
        },
        department: true,
      },
    });

    const leaderboard = agents.map((agent) => {
      const completed = agent.assignedTasks.length;
      
      const onTimeCompletions = agent.assignedTasks.filter(
        (t) => t.dueDate && t.updatedAt <= t.dueDate
      ).length;

      const onTimeRate = completed > 0 ? Math.round((onTimeCompletions / completed) * 100) : 100;

      // Combined ranking score
      const score = (completed * 10) + (onTimeRate * 0.5);

      return {
        userId: agent.id,
        userName: agent.name,
        profilePhoto: agent.profilePhoto,
        designation: agent.designation,
        department: agent.department?.name || 'Unassigned',
        completedCount: completed,
        onTimeRate,
        score: Math.round(score),
      };
    }).sort((a, b) => b.score - a.score);

    return res.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error fetching leaderboard list:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
