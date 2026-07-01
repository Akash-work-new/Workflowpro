'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Clock,
  FileSpreadsheet,
  History,
  LogOut,
  Menu,
  ChevronLeft,
  Search,
  Bell,
  Sun,
  Moon,
  User as UserIcon,
  Circle
} from 'lucide-react';
import { api } from '../lib/api';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, updateUserStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Keyboard shortcut listener (Ctrl+K for search, Escape, etc.)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        alert('Global search command palette opened! (Shortcuts: / for search, c for task create)');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Theme Sync
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Fetch Notifications when popover opens
  const fetchNotifications = async () => {
    const res = await api.get('/notifications');
    if (res.success && res.data) {
      setNotifications(res.data);
    }
  };

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user]);

  if (!user) {
    if (typeof window !== 'undefined' && pathname !== '/login') {
      router.push('/login');
    }
    return null;
  }

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', path: '/projects', icon: FolderKanban },
    { name: 'Tasks', path: '/tasks', icon: CheckSquare },
    { name: 'Performance', path: '/performance', icon: Users },
    { name: 'Time Tracking', path: '/time-tracking', icon: Clock },
    { name: 'Reports', path: '/reports', icon: FileSpreadsheet },
  ];

  // Super Admin view logs
  if (user.role.name === 'SUPER_ADMIN') {
    navItems.push({ name: 'Audit Logs', path: '/audit-logs', icon: History });
  }
  // Super Admin and Admin settings
  if (user.role.name === 'SUPER_ADMIN' || user.role.name === 'ADMIN') {
    navItems.push({ name: 'Admin Panel', path: '/admin', icon: UserIcon });
  }

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'ACTIVE': return 'bg-green-500 text-green-500';
      case 'BREAK': return 'bg-yellow-500 text-yellow-500';
      case 'MEETING': return 'bg-indigo-500 text-indigo-500';
      case 'ON_LEAVE': return 'bg-red-500 text-red-500';
      default: return 'bg-slate-400 text-slate-400';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Sidebar Navigation */}
      <motion.div
        animate={{ width: collapsed ? 70 : 250 }}
        className="h-full border-r border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col justify-between transition-all duration-300 z-50 shadow-lg"
      >
        <div>
          {/* Logo Branding */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-zinc-800">
            {!collapsed && (
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent font-outfit">
                WorkFlow Pro
              </span>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 mx-auto"
            >
              {collapsed ? <ChevronLeft className="rotate-180 w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 flex flex-col gap-1.5">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => router.push(item.path)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                      : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-3 border-t border-slate-100 dark:border-zinc-800">
          <button
            onClick={() => logout().then(() => router.push('/login'))}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </motion.div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header Console */}
        <header className="h-16 border-b border-slate-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md flex items-center justify-between px-6 z-40">
          {/* Left search */}
          <div className="relative max-w-xs w-full">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Search tasks, sprints... (Ctrl+K)"
              className="w-full bg-slate-100 dark:bg-zinc-800 text-xs pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 border border-slate-200 dark:border-zinc-700"
            />
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Notifications Alert */}
            <div className="relative">
              <button
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  fetchNotifications();
                }}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-zinc-300 relative"
              >
                <Bell className="w-4 h-4" />
                {notifications.some((n) => !n.isRead) && (
                  <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-zinc-900" />
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-2xl p-4 flex flex-col gap-2 max-h-96 overflow-y-auto"
                  >
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-2">
                      <span className="font-semibold text-sm">Notifications Feed</span>
                      <button
                        onClick={async () => {
                          await api.put('/notifications/read-all');
                          fetchNotifications();
                        }}
                        className="text-xs text-sky-500 hover:underline"
                      >
                        Read All
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <span className="text-xs text-slate-400 text-center py-6">No new alerts</span>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`p-2 rounded-lg text-xs ${
                            n.isRead ? 'opacity-65' : 'bg-sky-500/5 font-medium'
                          }`}
                        >
                          <p className="text-slate-800 dark:text-slate-200">{n.message}</p>
                          <span className="text-[10px] text-slate-400 block mt-1">
                            {new Date(n.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile Status menu */}
            <div className="relative">
              <button
                onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all text-xs"
              >
                <span className={`w-2.5 h-2.5 rounded-full ${getStatusColor(user.status)}`} />
                <span className="font-semibold text-slate-700 dark:text-slate-200">{user.name}</span>
              </button>

              <AnimatePresence>
                {statusMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 glass-panel rounded-xl shadow-2xl p-2 flex flex-col gap-1"
                  >
                    <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-zinc-800 mb-1">
                      <p className="font-bold text-xs truncate">{user.email}</p>
                      <p className="text-[10px] text-slate-400">{user.designation}</p>
                    </div>

                    {['ACTIVE', 'BREAK', 'MEETING', 'ON_LEAVE'].map((status) => (
                      <button
                        key={status}
                        onClick={async () => {
                          await updateUserStatus(status);
                          setStatusMenuOpen(false);
                        }}
                        className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-left text-xs text-slate-600 dark:text-zinc-300 font-medium"
                      >
                        <Circle className={`w-2.5 h-2.5 fill-current ${getStatusColor(status)}`} />
                        <span>{status.replace('_', ' ')}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          {children}
        </main>
      </div>
    </div>
  );
};
