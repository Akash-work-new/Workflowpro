import { Response, Request } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../config/db';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { logAudit } from '../services/auditService';
import { pushTaskHistory } from './taskController';
import { broadcastNotification } from '../config/socket';

// Add Comment (with mentions & watchers)
export const addComment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const { content, parentId } = req.body;
    const userId = req.user!.id;

    if (!content) {
      return res.status(400).json({ success: false, error: { message: 'Comment content is required' } });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { watchers: true },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId,
        content,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, name: true, profilePhoto: true } },
      },
    });

    await pushTaskHistory(taskId, userId, 'COMMENT_ADDED', null, null, `Added comment: "${content.substring(0, 30)}..."`);
    await logAudit(req, 'TASK_COMMENT_CREATION', { commentId: comment.id, taskId });

    // Parse Mentions (case-insensitive check for @Name in comment content)
    const allUsers = await prisma.user.findMany({
      where: { status: { not: 'INACTIVE' } },
    });

    const mentionedUsers = allUsers.filter((u) => {
      // Avoid mentioning self
      if (u.id === userId) return false;
      const mentionTag = `@${u.name.toLowerCase()}`;
      const mentionTagJoined = `@${u.name.replace(/\s+/g, '').toLowerCase()}`;
      const commentLower = content.toLowerCase();
      return commentLower.includes(mentionTag) || commentLower.includes(mentionTagJoined);
    });

    // Create Notification and Watcher for each mentioned user
    for (const user of mentionedUsers) {
      // Add as Watcher if not already
      const isWatching = task.watchers.some((w) => w.userId === user.id);
      if (!isWatching) {
        await prisma.taskWatcher.create({
          data: { taskId, userId: user.id },
        }).catch(() => {}); // ignore race condition duplicate
      }

      // Create notification
      const notification = await prisma.notification.create({
        data: {
          userId: user.id,
          title: 'You were mentioned',
          message: `${req.user!.name} mentioned you in: "${task.title}"`,
          type: 'COMMENT_ADDED',
        },
      });

      // Live emit socket
      broadcastNotification(user.id, notification);
    }

    // Also notify other watchers who were NOT explicitly mentioned
    const mentionedIds = mentionedUsers.map((u) => u.id);
    const otherWatchers = task.watchers.filter(
      (w) => w.userId !== userId && !mentionedIds.includes(w.userId)
    );

    for (const watcher of otherWatchers) {
      const notification = await prisma.notification.create({
        data: {
          userId: watcher.userId,
          title: 'New comment added',
          message: `${req.user!.name} commented on watched task: "${task.title}"`,
          type: 'COMMENT_ADDED',
        },
      });
      broadcastNotification(watcher.userId, notification);
    }

    return res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Upload Attachment (Local storage served statically)
export const uploadAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: taskId } = req.params;
    const userId = req.user!.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(404).json({ success: false, error: { message: 'Task not found' } });
    }

    // Create attachment in DB (save URL prefix)
    const fileUrl = `/uploads/${file.filename}`;

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId,
        userId,
        fileName: file.originalname,
        fileUrl,
        fileType: file.mimetype,
        fileSize: file.size,
      },
    });

    await pushTaskHistory(taskId, userId, 'UPDATED', null, null, `Uploaded file: ${file.originalname}`);
    await logAudit(req, 'TASK_ATTACHMENT_UPLOAD', { attachmentId: attachment.id, taskId });

    return res.status(201).json({
      success: true,
      data: attachment,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};

// Delete Attachment
export const deleteAttachment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return res.status(404).json({ success: false, error: { message: 'Attachment not found' } });
    }

    // Try deleting physical file
    const filePath = path.join(__dirname, '../../uploads', path.basename(attachment.fileUrl));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });

    await pushTaskHistory(attachment.taskId, req.user!.id, 'UPDATED', null, null, `Removed file: ${attachment.fileName}`);
    await logAudit(req, 'TASK_ATTACHMENT_DELETION', { attachmentId, taskId: attachment.taskId });

    return res.json({
      success: true,
      data: { message: 'Attachment removed successfully' },
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return res.status(500).json({ success: false, error: { message: 'Internal server error' } });
  }
};
