import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting and seeding clean database...');

  // 1. Clean existing operational data
  await prisma.aiAnalysis.deleteMany({});
  await prisma.savedFilter.deleteMany({});
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

  // 2. Create Roles (Defining the hierarchy: Super Admin, Admin, Sub Heads/Team Leads, Agents)
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

  // 3. Create a Single Super Admin User (Password: Password123)
  const passwordHash = await bcrypt.hash('Password123', 10);

  const superAdmin = await prisma.user.create({
    data: {
      employeeId: 'EMP-001',
      name: 'Super Admin',
      email: 'superadmin@workflowpro.com',
      passwordHash,
      designation: 'System Administrator',
      status: 'ACTIVE',
      roleId: superAdminRole.id,
      isEmailVerified: true,
    },
  });

  // 4. Create Departments (Customer Success, Operations, Marketing, Quality, HR)
  console.log('Seeding custom departments...');
  await prisma.department.createMany({
    data: [
      { name: 'Customer Success', description: 'Client support, onboarding, and relationship management' },
      { name: 'Operations', description: 'Business operations, logistics, and workflow optimization' },
      { name: 'Marketing', description: 'Brand awareness, social media, and client acquisition' },
      { name: 'Quality', description: 'Quality assurance, compliance, and standards validation' },
      { name: 'HR', description: 'Human resources, recruitment, and employee relations' },
    ],
  });

  console.log('Clean database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
