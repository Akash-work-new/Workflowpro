'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import {
  ListTodo,
  Search,
  Filter,
  CheckCircle,
  Clock,
  User,
  ArrowUpDown,
  Tag,
  Zap
} from 'lucide-react';

export default function TasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');

  // Bulk update states
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    let query = '';
    const params = [];
    if (search) params.push(`search=${search}`);
    if (status) params.push(`status=${status}`);
    if (priority) params.push(`priority=${priority}`);

    if (params.length > 0) query = `?${params.join('&')}`;

    const res = await api.get(`/tasks${query}`);
    if (res.success && res.data) {
      setTasks(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTasks();
  }, [search, status, priority]);

  const handleSelectTask = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === tasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(tasks.map((t) => t.id));
    }
  };

  const handleBulkUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkMessage('');
    if (selectedTaskIds.length === 0) return;

    const res = await api.post('/tasks/bulk-update', {
      taskIds: selectedTaskIds,
      status: bulkStatus || undefined,
      priority: bulkPriority || undefined,
    });

    if (res.success) {
      setBulkMessage(`Successfully updated ${selectedTaskIds.length} tasks!`);
      setSelectedTaskIds([]);
      setBulkStatus('');
      setBulkPriority('');
      fetchTasks();
    } else {
      setBulkMessage(res.error?.message || 'Bulk update failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full relative">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Tasks Console</h1>
            <p className="text-sm text-slate-500 mt-1">Cross-project task queries, metrics, and bulk operations.</p>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between border border-slate-200 dark:border-zinc-800 text-xs">
          <div className="flex flex-wrap gap-3 items-center flex-1 min-w-[300px]">
            {/* Search */}
            <div className="relative flex-grow max-w-xs">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search description/titles..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-100 dark:bg-zinc-800 pl-9 pr-4 py-2 rounded-lg focus:outline-none border border-slate-200 dark:border-zinc-700"
              />
            </div>

            {/* Status select */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold"
            >
              <option value="">All Statuses</option>
              <option value="BACKLOG">Backlog</option>
              <option value="TODO">Todo</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_REVIEW">Waiting Review</option>
              <option value="COMPLETED">Completed</option>
            </select>

            {/* Priority Select */}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-700 dark:text-zinc-300 font-semibold"
            >
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Tasks Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs font-semibold animate-pulse">LOADING TASK QUEUE...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl">
            <ListTodo className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h4 className="font-bold">No tasks matched query</h4>
            <p className="text-xs text-slate-500 mt-1">Refine filters to list matching action items.</p>
          </div>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 pb-16">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-zinc-900/80 text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-zinc-800">
                  <th className="p-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.length === tasks.length}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="p-4">Key</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Assignee</th>
                  <th className="p-4">Project</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="border-b border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all"
                  >
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={() => handleSelectTask(task.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="p-4 font-bold text-slate-400">
                      {task.project?.name.substring(0, 3).toUpperCase()}-{task.taskIndex}
                    </td>
                    <td className="p-4 font-semibold text-slate-800 dark:text-zinc-200">{task.title}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        task.priority === 'CRITICAL' ? 'priority-critical' : task.priority === 'HIGH' ? 'priority-high' : 'priority-medium'
                      }`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-sky-400 text-[10px]">{task.status.replace(/_/g, ' ')}</td>
                    <td className="p-4 text-slate-500 dark:text-zinc-400">{task.assignedTo?.name || 'Unassigned'}</td>
                    <td className="p-4 font-medium">{task.project?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Bulk Update Action Bar */}
        {selectedTaskIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 z-50">
            <div className="glass-panel p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-4 text-white text-xs">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg">
                  <Zap className="w-4 h-4" />
                </span>
                <span className="font-bold">
                  Bulk Actions ({selectedTaskIds.length} selected)
                </span>
              </div>

              <form onSubmit={handleBulkUpdateSubmit} className="flex gap-2 items-center flex-wrap">
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Update Status</option>
                  <option value="BACKLOG">Backlog</option>
                  <option value="TODO">Todo</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_FOR_REVIEW">Pending Approval</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                <select
                  value={bulkPriority}
                  onChange={(e) => setBulkPriority(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="">Update Priority</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                <button
                  type="submit"
                  className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-all"
                >
                  Apply
                </button>
              </form>
            </div>
          </div>
        )}

        {bulkMessage && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-sky-500 text-white text-xs px-4 py-2 rounded-lg shadow-lg z-50">
            {bulkMessage}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
