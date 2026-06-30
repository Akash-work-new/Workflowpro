'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import {
  TrendingUp,
  AlertTriangle,
  Users,
  Clock,
  Play,
  Square,
  Award,
  Zap,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingDown
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

export default function DashboardPage() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);

  // Admin Dashboard States
  const [adminStats, setAdminStats] = useState<any>(null);

  // Employee Scorecard States
  const [employeeStats, setEmployeeStats] = useState<any>(null);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [timerDesc, setTimerDesc] = useState('');
  const [activeTasks, setActiveTasks] = useState<any[]>([]);

  // Fetch Dashboard details based on Role
  const fetchData = async () => {
    setLoading(true);
    if (user?.role.name === 'ADMIN' || user?.role.name === 'SUPER_ADMIN') {
      const res = await api.get('/dashboard/admin');
      if (res.success && res.data) {
        setAdminStats(res.data);
      }
    } else {
      // Employee view
      const res = await api.get('/dashboard/employee');
      const timerRes = await api.get('/time-logs/active');
      const tasksRes = await api.get(`/tasks?assignedToId=${user?.id}`);

      if (res.success && res.data) setEmployeeStats(res.data);
      if (timerRes.success && timerRes.data) setActiveTimer(timerRes.data);
      if (tasksRes.success && tasksRes.data) {
        setActiveTasks(tasksRes.data.filter((t: any) => t.status !== 'COMPLETED' && t.status !== 'CLOSED'));
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Live Timer Clock ticker
  useEffect(() => {
    let interval: any = null;
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        const diff = Date.now() - start;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  // Sockets live refreshes
  useEffect(() => {
    if (socket) {
      socket.on('notification', () => {
        // Refresh dashboard statistics on live events
        fetchData();
      });
      return () => {
        socket.off('notification');
      };
    }
  }, [socket]);

  // Timer Handlers
  const handleStartTimer = async (taskId: string) => {
    const res = await api.post('/time-logs/start', { taskId, description: timerDesc });
    if (res.success && res.data) {
      setActiveTimer(res.data);
      setTimerDesc('');
      fetchData();
    }
  };

  const handleStopTimer = async () => {
    const res = await api.post('/time-logs/stop');
    if (res.success) {
      setActiveTimer(null);
      fetchData();
    }
  };

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-white">
        <span className="animate-pulse text-sm font-semibold tracking-wider">LOADING WORKSPACE...</span>
      </div>
    );
  }

  const isAdmin = user.role.name === 'ADMIN' || user.role.name === 'SUPER_ADMIN';

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 w-full">
        {/* Welcome Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">
              Dashboard Console
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Welcome back, <span className="font-semibold text-slate-700 dark:text-zinc-200">{user.name}</span> • Role: <span className="text-sky-500 font-bold">{user.role.name}</span>
            </p>
          </div>
          <div className="text-xs text-slate-400 font-medium">
            Active Status: <span className="px-2 py-1 rounded bg-sky-500/10 text-sky-400 font-bold">{user.status}</span>
          </div>
        </div>

        {/* ================================================== */}
        {/* ADMIN DASHBOARD VIEW */}
        {/* ================================================== */}
        {isAdmin && adminStats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: KPI Grid & Delayed Projects */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Core Counters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Open Tickets */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-500">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Open Tickets</span>
                  <h2 className="text-5xl font-extrabold font-outfit mt-4 text-sky-400">{adminStats.openTickets}</h2>
                  <p className="text-xs text-slate-500 mt-2">Active tasks currently in development queue.</p>
                </div>

                {/* Delayed Projects Count */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Delayed Projects</span>
                  <h2 className="text-5xl font-extrabold font-outfit mt-4 text-red-400">
                    {adminStats.delayedProjects.length}
                  </h2>
                  <p className="text-xs text-slate-500 mt-2">Projects that missed scheduled deadline targets.</p>
                </div>
              </div>

              {/* Delayed Projects Detailed List */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-bold font-outfit flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span>Overdue Projects List</span>
                </h3>
                {adminStats.delayedProjects.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">No overdue projects logged.</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {adminStats.delayedProjects.map((p: any) => (
                      <div key={p.id} className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 flex justify-between items-center text-xs">
                        <div>
                          <h4 className="font-bold text-slate-700 dark:text-zinc-200">{p.name}</h4>
                          <span className="text-slate-400">PM: {p.projectManager?.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-red-400 font-bold block">Missed Deadline</span>
                          <span className="text-slate-400">Due: {new Date(p.endDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Productivity Progress Charts */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-bold font-outfit flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-sky-500" />
                  <span>Team Productivity (Project Completion Rates)</span>
                </h3>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={adminStats.teamProductivity}>
                      <XAxis dataKey="projectName" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: '#121218', border: '1px solid #27272a', borderRadius: '8px' }} />
                      <Bar dataKey="completionRate" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Column: Revenue Tasks & Workload Balance & Agent Rankings */}
            <div className="flex flex-col gap-6">
              {/* Revenue-Impacting Tasks */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500 fill-current" />
                  <span>Revenue Impacting Tasks</span>
                </h3>
                {adminStats.revenueImpactingTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No pending revenue-impacting tasks.</p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-56 overflow-y-auto">
                    {adminStats.revenueImpactingTasks.map((t: any) => (
                      <div key={t.id} className="p-3 bg-yellow-500/5 rounded-xl border border-yellow-500/10 flex justify-between items-center text-xs">
                        <div>
                          <h4 className="font-bold truncate max-w-[150px]">{t.title}</h4>
                          <span className="text-[10px] text-slate-400">Proj: {t.project?.name}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-semibold uppercase text-[10px]">
                          {t.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Workload Imbalance Indicator */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-500" />
                  <span>Workload Balance Alert</span>
                </h3>
                <div className="flex flex-col gap-3 max-h-56 overflow-y-auto">
                  {adminStats.workloadImbalance.map((w: any) => (
                    <div key={w.userId} className="flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{w.userName}</span>
                        <span className={`font-semibold ${w.isOverloaded ? 'text-red-400' : 'text-slate-400'}`}>
                          {w.totalHoursAllocated} hrs
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full ${w.isOverloaded ? 'bg-red-500' : 'bg-sky-500'}`}
                          style={{ width: `${Math.min(100, (w.totalHoursAllocated / 40) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Rankings (Leaderboard) */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                  <Award className="w-4 h-4 text-sky-500" />
                  <span>Agent Performance Rankings</span>
                </h3>
                <div className="flex flex-col gap-3">
                  {adminStats.agentRankings.slice(0, 5).map((agent: any, idx: number) => (
                    <div key={agent.userId} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-400">{idx + 1}.</span>
                        <span className="font-medium">{agent.userName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{agent.completedCount} done</span>
                        <span className="font-bold text-sky-400">{agent.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* EMPLOYEE SCORECARD VIEW */}
        {/* ================================================== */}
        {!isAdmin && employeeStats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Content Column */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Scorecard Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {/* Productivity Score */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-sky-500/10 text-sky-500">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Productivity Score</span>
                  <h2 className="text-4xl font-extrabold font-outfit mt-3 text-sky-400">
                    {employeeStats.metrics.productivityScore}%
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-2">Based on task completion rates.</p>
                </div>

                {/* Efficiency Score */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Efficiency Rating</span>
                  <h2 className="text-4xl font-extrabold font-outfit mt-3 text-indigo-400">
                    {employeeStats.metrics.efficiencyScore}%
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-2">Estimated vs actual work hours.</p>
                </div>

                {/* On-Time Completion */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-green-500/10 text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">On-Time Delivery</span>
                  <h2 className="text-4xl font-extrabold font-outfit mt-3 text-green-400">
                    {employeeStats.metrics.onTimeCompletionPercentage}%
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-2">Tasks resolved before deadlines.</p>
                </div>
              </div>

              {/* Work Hours & Performance Charts */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-lg font-bold font-outfit mb-4">Task Deliveries Overview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* Task counts Pie */}
                  <div className="h-48 w-full flex justify-center relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Completed', value: employeeStats.metrics.tasksCompleted, color: '#22c55e' },
                            { name: 'Pending', value: employeeStats.metrics.tasksPending, color: '#0284c7' },
                            { name: 'Overdue', value: employeeStats.metrics.tasksOverdue, color: '#ef4444' },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#0284c7" />
                          <Cell fill="#ef4444" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-3xl font-extrabold font-outfit">{employeeStats.metrics.tasksAssigned}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Assigned Tasks</span>
                    </div>
                  </div>

                  {/* List metrics */}
                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                      <span className="font-semibold text-green-500">Tasks Completed</span>
                      <span className="font-bold">{employeeStats.metrics.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-sky-500/5 border border-sky-500/10">
                      <span className="font-semibold text-sky-500">Tasks Pending</span>
                      <span className="font-bold">{employeeStats.metrics.tasksPending}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                      <span className="font-semibold text-red-500">Tasks Overdue</span>
                      <span className="font-bold">{employeeStats.metrics.tasksOverdue}</span>
                    </div>
                    <div className="flex justify-between items-center p-2">
                      <span className="font-semibold text-slate-400">Total Hours Logged</span>
                      <span className="font-bold">{employeeStats.metrics.totalHoursLogged} hrs</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Workload & Timer Column */}
            <div className="flex flex-col gap-6">
              {/* Realtime Time Tracking Timer */}
              <div className="glass-panel rounded-2xl p-6 border-sky-500/20 relative overflow-hidden bg-gradient-to-br from-sky-500/5 via-transparent to-transparent">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Time Tracker</h3>
                <div className="flex flex-col items-center gap-4 py-3">
                  {/* Digital Clock */}
                  <div className="font-mono text-4xl font-extrabold tracking-widest text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-zinc-800/80 px-6 py-3 rounded-2xl border border-slate-200 dark:border-zinc-700/80 shadow-inner">
                    {elapsedTime}
                  </div>

                  {activeTimer ? (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <p className="text-xs text-sky-400 animate-pulse font-medium">
                        Timer Running on: {activeTimer.task?.title}
                      </p>
                      <button
                        onClick={handleStopTimer}
                        className="flex items-center gap-2 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-500/20 transition-all w-full justify-center"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>Stop Tracking</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 w-full">
                      <input
                        type="text"
                        placeholder="What are you working on?..."
                        value={timerDesc}
                        onChange={(e) => setTimerDesc(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs px-3 py-2 rounded-lg focus:outline-none"
                      />
                      {activeTasks.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center">No open tasks available to log.</p>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                          {activeTasks.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => handleStartTimer(t.id)}
                              className="flex justify-between items-center p-2 rounded bg-slate-100 dark:bg-zinc-800/50 hover:bg-sky-500/10 border border-slate-200 dark:border-zinc-800/80 text-left text-[10px] text-slate-600 dark:text-zinc-300 font-medium"
                            >
                              <span className="truncate max-w-[150px]">{t.title}</span>
                              <Play className="w-3.5 h-3.5 text-sky-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Active task Feed */}
              <div className="glass-panel rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">My Action Items</h3>
                {activeTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">All caught up! No active tasks assigned.</p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
                    {activeTasks.slice(0, 5).map((t) => (
                      <div
                        key={t.id}
                        className="p-3 bg-slate-100 dark:bg-zinc-800/40 rounded-xl border border-slate-200 dark:border-zinc-800/50 flex flex-col gap-1.5 text-xs cursor-pointer hover:border-sky-500/30 transition-all"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold truncate">{t.title}</h4>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                            t.priority === 'CRITICAL' ? 'priority-critical' : t.priority === 'HIGH' ? 'priority-high' : 'priority-medium'
                          }`}>
                            {t.priority}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span>Status: <span className="font-bold text-sky-400">{t.status.replace(/_/g, ' ')}</span></span>
                          {t.dueDate && (
                            <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
