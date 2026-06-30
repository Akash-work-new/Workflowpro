'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { Bell, Info, ShieldAlert, CheckCircle } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: string;
}

interface SocketContextType {
  socket: Socket | null;
  joinProjectRoom: (projectId: string) => void;
  leaveProjectRoom: (projectId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (title: string, message: string, type: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // Remove after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!user || !token) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
    });

    socketInstance.on('connect', () => {
      console.log('Connected to realtime Socket.io gateway');
    });

    socketInstance.on('notification', (notification: any) => {
      console.log('Realtime notification received:', notification);
      // Map notification types to toast alerts
      addToast(notification.title, notification.message, notification.type);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  const joinProjectRoom = (projectId: string) => {
    if (socket) {
      socket.emit('join_project', projectId);
    }
  };

  const leaveProjectRoom = (projectId: string) => {
    if (socket) {
      socket.emit('leave_project', projectId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, joinProjectRoom, leaveProjectRoom }}>
      {children}

      {/* Floating Toast Notification Stack */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => {
          const isCritical = toast.type === 'TASK_OVERDUE' || toast.type === 'REJECTED';
          const isSuccess = toast.type === 'TASK_COMPLETED' || toast.type === 'TASK_APPROVAL_APPROVE';
          
          return (
            <div
              key={toast.id}
              className="glass-panel rounded-xl p-4 flex gap-3 shadow-2xl animate-slide-in border-l-4 transition-all duration-300"
              style={{
                borderLeftColor: isCritical ? '#ef4444' : isSuccess ? '#22c55e' : '#0284c7',
              }}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isCritical ? (
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                ) : isSuccess ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Bell className="w-5 h-5 text-sky-500" />
                )}
              </div>
              <div className="flex-grow">
                <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                  {toast.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-semibold self-start"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Inject custom CSS keyframes for slide-in animation */}
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
