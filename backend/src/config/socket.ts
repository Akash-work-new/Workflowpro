import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'workflow_pro_secret_key_123';

let io: Server | null = null;

// Track active socket connections by User ID
const connectedUsers = new Map<string, string[]>(); // userId -> socketIds[]

export const initSocket = (server: HttpServer): Server => {
  io = new Server(server, {
    cors: {
      origin: '*', // Allow all origins for dev simplicity
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    },
  });

  // Socket authentication middleware
  io.use((socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId;
    console.log(`User connected to Socket.io: ${userId} (${socket.id})`);

    // Join personal room
    socket.join(`user_${userId}`);

    // Track active connection
    const currentSockets = connectedUsers.get(userId) || [];
    connectedUsers.set(userId, [...currentSockets, socket.id]);

    // Board sync room joining
    socket.on('join_project', (projectId: string) => {
      socket.join(`project_${projectId}`);
      console.log(`Socket ${socket.id} joined project room: ${projectId}`);
    });

    socket.on('leave_project', (projectId: string) => {
      socket.leave(`project_${projectId}`);
      console.log(`Socket ${socket.id} left project room: ${projectId}`);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from socket: ${socket.id}`);
      const userSockets = connectedUsers.get(userId) || [];
      const updatedSockets = userSockets.filter((sid) => sid !== socket.id);
      if (updatedSockets.length === 0) {
        connectedUsers.delete(userId);
      } else {
        connectedUsers.set(userId, updatedSockets);
      }
    });
  });

  return io;
};

// Helper: Broadcast live notification to a specific user
export const broadcastNotification = (userId: string, notification: any) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
};

// Helper: Sync board status changes to other users in the same project room
export const broadcastProjectUpdate = (projectId: string, updateData: any) => {
  if (io) {
    io.to(`project_${projectId}`).emit('project_sync', updateData);
  }
};
