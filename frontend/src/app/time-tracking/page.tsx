'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { Clock, Plus, Play, Square, ListTodo, Calendar } from 'lucide-react';

export default function TimeTrackingPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [loading, setLoading] = useState(true);

  // Manual logging fields
  const [taskId, setTaskId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const logsRes = await api.get('/time-logs');
    const tasksRes = await api.get('/tasks');
    const timerRes = await api.get('/time-logs/active');

    if (logsRes.success && logsRes.data) setLogs(logsRes.data);
    if (tasksRes.success && tasksRes.data) {
      // Filter only tasks user is assigned to or created
      setTasks(tasksRes.data.filter((t: any) => t.status !== 'COMPLETED' && t.status !== 'CLOSED'));
    }
    if (timerRes.success && timerRes.data) setActiveTimer(timerRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Live Timer Clock ticker
  useEffect(() => {
    let interval: any = null;
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        const diff = Date.now() - start;
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        setElapsedTime(
          `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        );
      }, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleManualLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!taskId || !hours) {
      setMessage('Please select a task and input duration.');
      return;
    }

    const res = await api.post('/time-logs/manual', {
      taskId,
      durationMinutes: parseFloat(hours) * 60,
      description,
      date: date || null,
    });

    if (res.success) {
      setMessage('Time logged successfully!');
      setTaskId('');
      setHours('');
      setDescription('');
      setDate('');
      fetchData();
    } else {
      setMessage(res.error?.message || 'Failed to log manual time.');
    }
  };

  const handleStopTimer = async () => {
    const res = await api.post('/time-logs/stop');
    if (res.success) {
      setActiveTimer(null);
      fetchData();
    }
  };

  const totalMinutes = logs.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-xs">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Time Sheets</h1>
            <p className="text-sm text-slate-500 mt-1">Track billable hours, active task timers, and manual log files.</p>
          </div>
          <div className="text-sm font-bold text-sky-400">
            Total Logged: <span className="px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20">{totalHours} hrs</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Logs history */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Active Running Timer */}
            {activeTimer && (
              <div className="glass-panel p-6 rounded-2xl border border-sky-500/25 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-sky-500/5 to-transparent">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl animate-pulse">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-200">Active Timer Running</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Task: {activeTimer.task?.title}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono text-3xl font-extrabold tracking-widest text-slate-800 dark:text-zinc-200">
                    {elapsedTime}
                  </span>
                  <button
                    onClick={handleStopTimer}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Stop Timer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Time Sheet History */}
            <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
              <div className="p-4 border-b border-slate-200 dark:border-zinc-800 font-bold font-outfit text-sm">
                Logged Work Entries
              </div>
              {loading ? (
                <div className="text-center py-12 text-slate-400 font-semibold animate-pulse">LOADING TIMESHEETS...</div>
              ) : logs.length === 0 ? (
                <p className="text-center py-16 text-slate-500">No time logs recorded.</p>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-zinc-900/80 text-slate-400 font-bold border-b border-slate-200 dark:border-zinc-800 uppercase">
                      <th className="p-4">Task</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Date</th>
                      <th className="p-4 text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-200 dark:border-zinc-800/85 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all"
                      >
                        <td className="p-4 font-bold text-slate-700 dark:text-zinc-300">
                          {log.task?.project?.name.substring(0, 3).toUpperCase()}-{log.task?.taskIndex}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-zinc-400">{log.description || 'Logged work.'}</td>
                        <td className="p-4 text-slate-400">{new Date(log.startTime).toLocaleDateString()}</td>
                        <td className="p-4 text-right font-bold text-sky-400">
                          {(log.durationMinutes / 60).toFixed(1)} hrs
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Column: Manual form */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 h-fit">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-500" />
              <span>Log Manual Time</span>
            </h3>

            {message && <p className="text-xs text-sky-500 bg-sky-500/5 p-2 rounded border border-sky-500/20 mb-4">{message}</p>}

            <form onSubmit={handleManualLogSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Select Task *</label>
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                >
                  <option value="">Choose task</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Hours *</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 3.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-slate-500">Description</label>
                <textarea
                  placeholder="What work was accomplished?..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg shadow-lg shadow-sky-500/20 transition-all"
              >
                Log Entry
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
