import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing data
  await prisma.aiAnalysis.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.taskHistory.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.performanceReview.deleteMany({});
  await prisma.performanceGoal.deleteMany({});
  await prisma.timeLog.deleteMany({});
  await prisma.taskWatcher.deleteMany({});
  await prisma.taskChecklist.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.taskDependency.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.sprint.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});

  // 2. Create Roles
  const superAdminRole = await prisma.role.create({
    data: {
      name: 'SUPER_ADMIN',
      permissions: JSON.stringify(['ALL']),
    },
  });

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      permissions: JSON.stringify([
        'VIEW_DEPT_DASHBOARD',
        'CREATE_PROJECT',
        'UPDATE_PROJECT',
        'DELETE_PROJECT',
        'MANAGE_USERS',
        'VIEW_REPORTS',
        'VIEW_AUDIT_LOGS'
      ]),
    },
  });

  const leadRole = await prisma.role.create({
    data: {
      name: 'TEAM_LEAD',
      permissions: JSON.stringify([
        'VIEW_TEAM_DASHBOARD',
        'CREATE_TASK',
        'ASSIGN_TASK',
        'APPROVE_TASK',
        'VIEW_REPORTS'
      ]),
    },
  });

  const agentRole = await prisma.role.create({
    data: {
      name: 'AGENT',
      permissions: JSON.stringify([
        'VIEW_MY_TASKS',
        'UPDATE_MY_TASKS',
        'CREATE_COMMENT'
      ]),
    },
  });

  // 3. Create Departments
  const engDept = await prisma.department.create({
    data: {
      name: 'Engineering',
      description: 'Software development, testing, and operations',
    },
  });

  const mktDept = await prisma.department.create({
    data: {
      name: 'Marketing',
      description: 'Brand strategy, growth hacking, and campaigns',
    },
  });

  // 4. Create Users (Password: Password123)
  const passwordHash = await bcrypt.hash('Password123', 10);

  // Super Admin
  const superAdmin = await prisma.user.create({
    data: {
      employeeId: 'EMP-001',
      name: 'Sarah Connor',
      email: 'superadmin@workflowpro.com',
      passwordHash,
      designation: 'CEO / Chief Architect',
      status: 'ACTIVE',
      roleId: superAdminRole.id,
      isEmailVerified: true,
    },
  });

  // Department Admin (Engineering Manager)
  const engAdmin = await prisma.user.create({
    data: {
      employeeId: 'EMP-002',
      name: 'Robert Vance',
      email: 'admin@workflowpro.com',
      passwordHash,
      designation: 'VP of Engineering',
      status: 'ACTIVE',
      roleId: adminRole.id,
      departmentId: engDept.id,
      isEmailVerified: true,
    },
  });

  // Update Engineering Department Manager
  await prisma.department.update({
    where: { id: engDept.id },
    data: { managerId: engAdmin.id },
  });

  // Team Lead
  const teamLead = await prisma.user.create({
    data: {
      employeeId: 'EMP-003',
      name: 'Jim Halpert',
      email: 'lead@workflowpro.com',
      passwordHash,
      designation: 'Lead Engineer',
      status: 'ACTIVE',
      roleId: leadRole.id,
      departmentId: engDept.id,
      managerId: engAdmin.id,
      isEmailVerified: true,
    },
  });

  // Agent 1
  const agent1 = await prisma.user.create({
    data: {
      employeeId: 'EMP-004',
      name: 'Pam Beesly',
      email: 'agent1@workflowpro.com',
      passwordHash,
      designation: 'Frontend Developer',
      status: 'ACTIVE',
      roleId: agentRole.id,
      departmentId: engDept.id,
      managerId: teamLead.id,
      isEmailVerified: true,
    },
  });

  // Agent 2
  const agent2 = await prisma.user.create({
    data: {
      employeeId: 'EMP-005',
      name: 'Dwight Schrute',
      email: 'agent2@workflowpro.com',
      passwordHash,
      designation: 'Backend Developer',
      status: 'ACTIVE',
      roleId: agentRole.id,
      departmentId: engDept.id,
      managerId: teamLead.id,
      isEmailVerified: true,
    },
  });

  // 5. Create Teams
  const frontendTeam = await prisma.team.create({
    data: {
      name: 'Frontend Crew',
      description: 'Responsible for Next.js app user experience',
      departmentId: engDept.id,
      leadId: teamLead.id,
    },
  });

  const backendTeam = await prisma.team.create({
    data: {
      name: 'Backend Core',
      description: 'Responsible for APIs, DB queries, and AI workers',
      departmentId: engDept.id,
      leadId: teamLead.id,
    },
  });

  // Associate team members
  await prisma.teamMember.create({
    data: { teamId: frontendTeam.id, userId: agent1.id },
  });
  await prisma.teamMember.create({
    data: { teamId: backendTeam.id, userId: agent2.id },
  });

  // 6. Create Projects
  const coreProject = await prisma.project.create({
    data: {
      name: 'Workflow Pro Platform',
      description: 'Developing the modular enterprise task manager with AI metrics',
      departmentId: engDept.id,
      projectManagerId: engAdmin.id,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-12-31'),
      status: 'ACTIVE',
      customStatuses: JSON.stringify(['RESEARCH', 'DESIGN', 'IN_REVIEW']),
    },
  });

  // 7. Create Sprints
  const sprint1 = await prisma.sprint.create({
    data: {
      name: 'Sprint 1: Core Setup & Auth',
      projectId: coreProject.id,
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-15'),
      status: 'COMPLETED',
    },
  });

  const sprint2 = await prisma.sprint.create({
    data: {
      name: 'Sprint 2: Task Engines',
      projectId: coreProject.id,
      startDate: new Date('2026-06-16'),
      endDate: new Date('2026-06-30'),
      status: 'ACTIVE',
    },
  });

  // 8. Create Tasks
  // Task 1: Complete database schemas (Completed)
  const task1 = await prisma.task.create({
    data: {
      taskIndex: 1,
      title: 'Design Database Schemas',
      description: 'Establish normalized relational tables including users, custom RBAC permissions, audit histories, and time log tracks.',
      priority: 'CRITICAL',
      category: 'Story',
      status: 'COMPLETED',
      projectId: coreProject.id,
      sprintId: sprint1.id,
      assignedById: teamLead.id,
      assignedToId: agent2.id,
      startDate: new Date('2026-06-02'),
      dueDate: new Date('2026-06-07'),
      estimatedHours: 12.0,
      actualHours: 14.5,
      tags: JSON.stringify(['database', 'backend']),
      isRevenueImpacting: true,
    },
  });

  // Task 2: Implement JWT Authentication (Completed)
  const task2 = await prisma.task.create({
    data: {
      taskIndex: 2,
      title: 'Setup JWT & Refresh Token System',
      description: 'Implement secure cookie refresh cycles, register routes, and 2FA generator middleware.',
      priority: 'HIGH',
      category: 'Task',
      status: 'COMPLETED',
      projectId: coreProject.id,
      sprintId: sprint1.id,
      assignedById: teamLead.id,
      assignedToId: agent2.id,
      startDate: new Date('2026-06-08'),
      dueDate: new Date('2026-06-14'),
      estimatedHours: 8.0,
      actualHours: 8.0,
      tags: JSON.stringify(['auth', 'security']),
    },
  });

  // Task 3: Develop Board View UI (In Progress)
  const task3 = await prisma.task.create({
    data: {
      taskIndex: 3,
      title: 'Build JIRA-style Kanban Board UI',
      description: 'Implement drag-and-drop task movements, glassmorphism status lanes, and quick filters.',
      priority: 'CRITICAL',
      category: 'Feature',
      status: 'IN_PROGRESS',
      projectId: coreProject.id,
      sprintId: sprint2.id,
      assignedById: teamLead.id,
      assignedToId: agent1.id,
      startDate: new Date('2026-06-17'),
      dueDate: new Date('2026-06-26'), // Due soon
      estimatedHours: 20.0,
      actualHours: 12.5,
      tags: JSON.stringify(['frontend', 'ui']),
      isRevenueImpacting: true,
    },
  });

  // Task 4: Setup Socket.io notifications (Blocked by Task 3)
  const task4 = await prisma.task.create({
    data: {
      taskIndex: 4,
      title: 'Integrate Realtime Toast Notifications',
      description: 'Configure Socket.io connections on backend to broadcast mentions and task creations.',
      priority: 'MEDIUM',
      category: 'Feature',
      status: 'BLOCKED',
      projectId: coreProject.id,
      sprintId: sprint2.id,
      assignedById: teamLead.id,
      assignedToId: agent2.id,
      startDate: new Date('2026-06-20'),
      dueDate: new Date('2026-06-29'),
      estimatedHours: 10.0,
      actualHours: 0.0,
      tags: JSON.stringify(['realtime', 'notifications']),
    },
  });

  // Task 5: Approval Review Task (Waiting For Review)
  const task5 = await prisma.task.create({
    data: {
      taskIndex: 5,
      title: 'Write User Profile Management Interface',
      description: 'Build UI for showing employee status flags, employee cards, and standard active logs.',
      priority: 'LOW',
      category: 'Feature',
      status: 'WAITING_FOR_REVIEW',
      projectId: coreProject.id,
      sprintId: sprint2.id,
      assignedById: teamLead.id,
      assignedToId: agent1.id,
      startDate: new Date('2026-06-16'),
      dueDate: new Date('2026-06-22'), // Overdue!
      estimatedHours: 6.0,
      actualHours: 7.5,
      tags: JSON.stringify(['frontend', 'profile']),
    },
  });

  // 9. Create Task Dependencies (Task 4 blocked by Task 3)
  await prisma.taskDependency.create({
    data: {
      dependentTaskId: task4.id,
      dependsOnTaskId: task3.id,
    },
  });

  // 10. Create Watchers
  await prisma.taskWatcher.create({
    data: { taskId: task3.id, userId: teamLead.id },
  });

  // 11. Create Comments & Threaded replies
  const comment1 = await prisma.taskComment.create({
    data: {
      taskId: task3.id,
      userId: agent1.id,
      content: 'I have set up the basic layout. Currently implementing drag operations.',
    },
  });

  await prisma.taskComment.create({
    data: {
      taskId: task3.id,
      userId: teamLead.id,
      content: 'Make sure it is mobile responsive and matches the neutral glassmorphic panels.',
      parentId: comment1.id,
    },
  });

  // 12. Create Time Logs
  await prisma.timeLog.create({
    data: {
      taskId: task1.id,
      userId: agent2.id,
      startTime: new Date('2026-06-02T09:00:00Z'),
      endTime: new Date('2026-06-02T17:00:00Z'),
      durationMinutes: 480,
      description: 'Drafting entity tables and relationships.',
    },
  });

  await prisma.timeLog.create({
    data: {
      taskId: task3.id,
      userId: agent1.id,
      startTime: new Date('2026-06-17T09:00:00Z'),
      endTime: new Date('2026-06-17T15:30:00Z'),
      durationMinutes: 390,
      description: 'Creating frontend view mock and lanes.',
    },
  });

  // 13. Create Performance goals
  await prisma.performanceGoal.create({
    data: {
      userId: agent1.id,
      title: 'Frontend Accuracy',
      description: 'Reduce UI visual regressions and achieve 95% on-time feature completions.',
      targetValue: 95.0,
      currentValue: 88.0,
      unit: '%',
      status: 'IN_PROGRESS',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      reviewerId: teamLead.id,
    },
  });

  await prisma.performanceGoal.create({
    data: {
      userId: agent2.id,
      title: 'Database Load Speed',
      description: 'Ensure indexing queries execute under 50ms.',
      targetValue: 50.0,
      currentValue: 40.0, // Achieved
      unit: 'ms',
      status: 'ACHIEVED',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-06-30'),
      reviewerId: teamLead.id,
    },
  });

  // 14. Create Auditing Logs & Task History
  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'USER_LOGIN',
      details: JSON.stringify({ email: superAdmin.email }),
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    },
  });

  await prisma.taskHistory.create({
    data: {
      taskId: task3.id,
      userId: teamLead.id,
      event: 'CREATED',
      newValue: 'Task Created',
      details: 'Task initialized by lead',
    },
  });

  await prisma.taskHistory.create({
    data: {
      taskId: task3.id,
      userId: agent1.id,
      event: 'STATUS_CHANGED',
      oldValue: 'BACKLOG',
      newValue: 'IN_PROGRESS',
      details: 'Moved to progress lane',
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
