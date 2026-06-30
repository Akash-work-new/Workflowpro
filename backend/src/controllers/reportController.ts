import { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// Export report
export const exportReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reportType, format, departmentId, projectId } = req.query;

    if (!reportType || !format) {
      return res.status(400).json({ success: false, error: { message: 'Missing reportType or format' } });
    }

    // 1. Gather Data based on Report Type
    let dataList: any[] = [];
    let headers: string[] = [];
    let title = '';

    if (reportType === 'employee-productivity') {
      title = 'Employee Productivity Report';
      headers = ['Employee ID', 'Name', 'Designation', 'Department', 'Completed Tasks', 'Overdue Tasks'];
      
      const users = await prisma.user.findMany({
        where: departmentId ? { departmentId: departmentId as string } : {},
        include: {
          department: true,
          assignedTasks: true,
        },
      });

      dataList = users.map((u) => {
        const completed = u.assignedTasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
        const now = new Date();
        const overdue = u.assignedTasks.filter(
          (t) =>
            t.status !== 'COMPLETED' &&
            t.status !== 'CLOSED' &&
            t.status !== 'CANCELLED' &&
            t.dueDate &&
            new Date(t.dueDate) < now
        ).length;

        return {
          'Employee ID': u.employeeId,
          'Name': u.name,
          'Designation': u.designation,
          'Department': u.department?.name || 'N/A',
          'Completed Tasks': completed,
          'Overdue Tasks': overdue,
        };
      });
    } else if (reportType === 'project-progress') {
      title = 'Project Progress & Health Report';
      headers = ['Project Name', 'Status', 'Start Date', 'End Date', 'Total Tasks', 'Completed', 'Progress (%)'];

      const projects = await prisma.project.findMany({
        where: departmentId ? { departmentId: departmentId as string } : {},
        include: { tasks: true },
      });

      dataList = projects.map((p) => {
        const total = p.tasks.length;
        const completed = p.tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'CLOSED').length;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          'Project Name': p.name,
          'Status': p.status,
          'Start Date': p.startDate.toISOString().split('T')[0],
          'End Date': p.endDate.toISOString().split('T')[0],
          'Total Tasks': total,
          'Completed': completed,
          'Progress (%)': progress,
        };
      });
    } else if (reportType === 'overdue-tasks') {
      title = 'Overdue Action Items Report';
      headers = ['Task ID', 'Title', 'Priority', 'Assignee', 'Due Date', 'Days Overdue'];

      const now = new Date();
      const tasks = await prisma.task.findMany({
        where: {
          projectId: projectId ? (projectId as string) : undefined,
          status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED'] },
          dueDate: { lt: now },
        },
        include: {
          assignedTo: true,
          project: true,
        },
      });

      dataList = tasks.map((t) => {
        const due = new Date(t.dueDate!);
        const diffMs = now.getTime() - due.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        return {
          'Task ID': `${t.project.name.substring(0, 3).toUpperCase()}-${t.taskIndex}`,
          'Title': t.title,
          'Priority': t.priority,
          'Assignee': t.assignedTo?.name || 'Unassigned',
          'Due Date': due.toISOString().split('T')[0],
          'Days Overdue': days,
        };
      });
    } else if (reportType === 'task-completion') {
      title = 'Task Completion Metric Analysis';
      headers = ['Task ID', 'Title', 'Category', 'Priority', 'Status', 'Assignee', 'Estimate (hrs)', 'Actual (hrs)'];

      const tasks = await prisma.task.findMany({
        where: projectId ? { projectId: projectId as string } : {},
        include: {
          assignedTo: true,
          project: true,
        },
      });

      dataList = tasks.map((t) => ({
        'Task ID': `${t.project.name.substring(0, 3).toUpperCase()}-${t.taskIndex}`,
        'Title': t.title,
        'Category': t.category || 'Task',
        'Priority': t.priority,
        'Status': t.status,
        'Assignee': t.assignedTo?.name || 'Unassigned',
        'Estimate (hrs)': t.estimatedHours || 0.0,
        'Actual (hrs)': t.actualHours || 0.0,
      }));
    } else {
      return res.status(400).json({ success: false, error: { message: 'Invalid reportType query parameter' } });
    }

    // 2. Dispatch report format exporter
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.csv"`);

      const csvRows = [headers.join(',')];
      for (const row of dataList) {
        const values = headers.map((h) => {
          const val = row[h];
          return `"${String(val).replace(/"/g, '""')}"`; // Escape double quotes
        });
        csvRows.push(values.join(','));
      }
      return res.send(csvRows.join('\n'));
    }

    if (format === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.xlsx"`);

      const worksheet = XLSX.utils.json_to_sheet(dataList);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      return res.send(buffer);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-${Date.now()}.pdf"`);

      const doc = new PDFDocument({ margin: 30 });
      doc.pipe(res);

      // Header Design
      doc.fontSize(22).fillColor('#0284c7').text('WorkFlow Pro Enterprise Reports', { align: 'center' });
      doc.fontSize(12).fillColor('#4b5563').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(1.5);
      
      doc.fontSize(16).fillColor('#0f172a').text(title, { underline: true });
      doc.moveDown(1.0);

      // Simple PDF Table Generator
      const startX = 30;
      let startY = doc.y;
      const colWidth = 550 / headers.length;

      // Draw Table Header
      doc.fontSize(10).fillColor('#ffffff');
      doc.rect(startX, startY, 550, 20).fill('#0f172a');
      
      headers.forEach((header, index) => {
        doc.text(header, startX + index * colWidth + 5, startY + 5, { width: colWidth - 10, lineBreak: false });
      });

      startY += 20;
      doc.fillColor('#0f172a');

      // Draw Data Rows
      dataList.forEach((row, rowIndex) => {
        // Page break checker
        if (startY > 700) {
          doc.addPage();
          startY = 40;
        }

        // Zebra striping
        if (rowIndex % 2 === 0) {
          doc.rect(startX, startY, 550, 18).fill('#f8fafc');
          doc.fillColor('#0f172a');
        }

        headers.forEach((header, colIndex) => {
          const textVal = String(row[header] !== undefined ? row[header] : '');
          doc.text(textVal, startX + colIndex * colWidth + 5, startY + 4, { width: colWidth - 10, lineBreak: false });
        });
        startY += 18;
      });

      doc.end();
      return;
    }

    return res.status(400).json({ success: false, error: { message: 'Invalid format selection' } });
  } catch (error) {
    console.error('Error generating report file:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
