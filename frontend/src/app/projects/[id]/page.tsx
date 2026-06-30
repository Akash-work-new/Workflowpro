'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import { useSocket } from '../../../context/SocketContext';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { api } from '../../../lib/api';
import {
  KanbanSquare,
  ListFilter,
  CalendarDays,
  GanttChartSquare,
  Plus,
  Play,
  CheckSquare,
  FileText,
  User,
  Sparkles,
  AlertTriangle,
  Clock,
  Send,
  Trash2,
  ListTodo
} from 'lucide-react';
import { broadcastProjectUpdate } from '@/config/socket';

export default function ProjectDetailsPage() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const { joinProjectRoom, leaveProjectRoom, socket } = useSocket();
  const router = useRouter();

  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sprints, setSprints] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'kanban' | 'list' | 'calendar' | 'timeline'>('kanban');
  const [loading, setLoading] = useState(true);

  // Modals & Panels
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null); // Drawer detail
  const [commentText, setCommentText] = useState('');
  const [timeLogHours, setTimeLogHours] = useState('');
  const [timeLogDesc, setTimeLogDesc] = useState('');

  // Task creation fields
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');
  const [taskCategory, setTaskCategory] = useState('Story');
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [isRevenueImpacting, setIsRevenueImpacting] = useState(false);

  // Sprint Creation fields
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintStart, setSprintStart] = useState('');
  const [sprintEnd, setSprintEnd] = useState('');

  // AI suggestions states
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  const fetchProjectData = async () => {
    setLoading(true);
    const res = await api.get(`/projects/${projectId}`);
    if (res.success && res.data) {
      setProject(res.data);
      setTasks(res.data.tasks || []);
      setSprints(res.data.sprints || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
      joinProjectRoom(projectId as string);
    }
    return () => {
      if (projectId) leaveProjectRoom(projectId as string);
    };
  }, [projectId]);

  // Sync real-time task updates via websockets
  useEffect(() => {
    if (socket) {
      socket.on('project_sync', () => {
        fetchProjectData();
      });
      return () => {
        socket.off('project_sync');
      };
    }
  }, [socket]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    const res = await api.post('/tasks', {
      title: taskTitle,
      description: taskDesc,
      priority: taskPriority,
      category: taskCategory,
      projectId,
      sprintId: selectedSprintId || null,
      assignedToId: assignedToId || null,
      dueDate: dueDate || null,
      estimatedHours: estimatedHours || null,
      dependencies,
      isRevenueImpacting,
    });

    if (res.success) {
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
      setDueDate('');
      setEstimatedHours('');
      setIsRevenueImpacting(false);
      setDependencies([]);
      fetchProjectData();
      socket?.emit('join_project', projectId); // Sync
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sprintName || !sprintStart || !sprintEnd) return;

    const res = await api.post(`/projects/${projectId}/sprints`, {
      name: sprintName,
      startDate: sprintStart,
      endDate: sprintEnd,
    });

    if (res.success) {
      setShowSprintModal(false);
      setSprintName('');
      setSprintStart('');
      setSprintEnd('');
      fetchProjectData();
    }
  };

  const handleStatusTransition = async (taskId: string, newStatus: string) => {
    const res = await api.put(`/tasks/${taskId}`, { status: newStatus });
    if (res.success) {
      fetchProjectData();
      if (selectedTask?.id === taskId) {
        // Refresh active drawer details
        api.get(`/tasks/${taskId}`).then((r) => {
          if (r.success) setSelectedTask(r.data);
        });
      }
    } else {
      alert(res.error?.message || 'Failed to update status.');
    }
  };

  // Approval review submit
  const handleApprovalReview = async (taskId: string, approved: boolean, reason?: string) => {
    const res = await api.post(`/tasks/${taskId}/approval`, { approved, rejectionReason: reason });
    if (res.success) {
      fetchProjectData();
      setSelectedTask(null); // Close details drawer
    } else {
      alert(res.error?.message || 'Failed to submit review');
    }
  };

  // Add Comment inside task detail drawer
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText || !selectedTask) return;

    const res = await api.post(`/tasks/${selectedTask.id}/comments`, { content: commentText });
    if (res.success && res.data) {
      setCommentText('');
      // Reload task details inside drawer
      const detailRes = await api.get(`/tasks/${selectedTask.id}`);
      if (detailRes.success) {
        setSelectedTask(detailRes.data);
      }
    }
  };

  // Log manual hours
  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timeLogHours || !selectedTask) return;

    const res = await api.post('/time-logs/manual', {
      taskId: selectedTask.id,
      durationMinutes: parseFloat(timeLogHours) * 60,
      description: timeLogDesc,
    });

    if (res.success) {
      setTimeLogHours('');
      setTimeLogDesc('');
      const detailRes = await api.get(`/tasks/${selectedTask.id}`);
      if (detailRes.success) setSelectedTask(detailRes.data);
      fetchProjectData();
    }
  };

  // AI Estimate & Risk
  const triggerAiEstimation = async (task: any) => {
    setAiSuggestions({ loading: true });
    
    const estRes = await api.post('/ai/task/estimate', { title: task.title, description: task.description, priority: task.priority });
    const riskRes = await api.post('/ai/task/delay-prediction', { taskId: task.id });
    
    if (estRes.success && riskRes.success) {
      setAiSuggestions({
        estimatedHours: estRes.data.estimatedHours,
        confidence: estRes.data.confidence,
        risk: riskRes.data.riskLevel,
        delayProbability: riskRes.data.delayProbability,
        reason: riskRes.data.reason,
      });
    } else {
      setAiSuggestions({ error: 'AI failed to respond. Fallback algorithm offline.' });
    }
  };

  // AI Checklist subtask generator
  const triggerAiSubtasks = async (task: any) => {
    const res = await api.post('/ai/task/subtasks', { title: task.title, description: task.description });
    if (res.success && res.data) {
      // Create checklist items
      for (const sub of res.data) {
        // Mock add checklists to DB or prompt user to check them
        console.log('AI Subtask created:', sub);
      }
      alert(`AI generated ${res.data.length} subtasks! (See console logs)`);
    }
  };

  if (loading || !project) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-slate-400 text-xs font-semibold animate-pulse">LOADING PROJECT ENVIRONMENT...</div>
      </DashboardLayout>
    );
  }

  const statuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'WAITING_FOR_REVIEW', 'TESTING', 'COMPLETED'];
  
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full h-full relative">
        {/* Project Header controls */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h2 className="text-2xl font-extrabold font-outfit">{project.name}</h2>
            <p className="text-xs text-slate-400 mt-1">{project.description || 'No description'}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View selectors */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'kanban' ? 'bg-sky-500 text-white' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <KanbanSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                onClick={() => setActiveTab('list')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'list' ? 'bg-sky-500 text-white' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'calendar' ? 'bg-sky-500 text-white' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'timeline' ? 'bg-sky-500 text-white' : 'text-slate-500 dark:text-zinc-400'
                }`}
              >
                <GanttChartSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Timeline</span>
              </button>
            </div>

            {/* Creation Buttons */}
            <button
              onClick={() => setShowSprintModal(true)}
              className="px-3.5 py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all"
            >
              Add Sprint
            </button>
            <button
              onClick={() => setShowTaskModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* ================================================== */}
        {/* KANBAN BOARD VIEW */}
        {/* ================================================== */}
        {activeTab === 'kanban' && (
          <div className="flex-1 overflow-x-auto flex gap-4 pb-6 min-h-[500px]">
            {statuses.map((status) => {
              const statusTasks = tasks.filter((t) => t.status === status);
              return (
                <div
                  key={status}
                  className="flex-shrink-0 w-72 glass-panel rounded-2xl p-4 flex flex-col gap-3 min-h-[400px] bg-slate-100/50 dark:bg-zinc-900/30 border border-slate-200/60 dark:border-zinc-800/50"
                >
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-zinc-800 pb-2">
                    <span className="font-bold text-xs tracking-wide uppercase text-slate-500 dark:text-zinc-400">
                      {status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] bg-slate-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-bold text-slate-500">
                      {statusTasks.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 overflow-y-auto flex-1 max-h-[500px]">
                    {statusTasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={async () => {
                          const res = await api.get(`/tasks/${task.id}`);
                          if (res.success) setSelectedTask(res.data);
                        }}
                        className="glass-panel p-4 rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800/80 cursor-pointer hover:border-sky-500/40 hover:shadow-md transition-all flex flex-col gap-3 bg-white dark:bg-zinc-900/60"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-xs leading-relaxed text-slate-800 dark:text-zinc-200 line-clamp-2">
                            {task.title}
                          </h4>
                          {task.isRevenueImpacting && (
                            <span className="text-[8px] px-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 font-bold rounded">REV</span>
                          )}
                        </div>

                        <div className="flex justify-between items-center text-[9px] text-slate-400">
                          <span className={`px-1.5 py-0.5 rounded font-bold uppercase ${
                            task.priority === 'CRITICAL' ? 'priority-critical' : task.priority === 'HIGH' ? 'priority-high' : 'priority-medium'
                          }`}>
                            {task.priority}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {task.assignedTo ? (
                              <div className="w-5 h-5 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-[8px] font-bold text-sky-500">
                                {task.assignedTo.name.substring(0, 2).toUpperCase()}
                              </div>
                            ) : (
                              <User className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================================================== */}
        {/* LIST VIEW */}
        {/* ================================================== */}
        {activeTab === 'list' && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-zinc-900/80 text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-zinc-800">
                  <th className="p-4">Key</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Priority</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Assignee</th>
                  <th className="p-4">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={async () => {
                      const res = await api.get(`/tasks/${task.id}`);
                      if (res.success) setSelectedTask(res.data);
                    }}
                    className="border-b border-slate-200 dark:border-zinc-800/80 hover:bg-slate-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-all"
                  >
                    <td className="p-4 font-bold text-slate-400">{project.name.substring(0, 3).toUpperCase()}-{task.taskIndex}</td>
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
                    <td className="p-4 text-slate-400">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ================================================== */}
        {/* CALENDAR VIEW */}
        {/* ================================================== */}
        {activeTab === 'calendar' && (
          <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-zinc-800">
            <div className="grid grid-cols-7 gap-3 text-center text-xs font-bold text-slate-400 uppercase border-b border-slate-100 dark:border-zinc-800 pb-3 mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <span key={d}>{d}</span>)}
            </div>
            {/* simple monthly grid rendering (representing current month days) */}
            <div className="grid grid-cols-7 gap-3 min-h-[350px]">
              {Array.from({ length: 35 }).map((_, idx) => {
                const day = (idx % 30) + 1;
                // Gather tasks due on this day (mock mapping matching date days index)
                const dayTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getDate() === day);

                return (
                  <div key={idx} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-2 min-h-[70px] flex flex-col justify-between bg-slate-50/50 dark:bg-zinc-900/10">
                    <span className="text-[10px] font-bold text-slate-400">{day}</span>
                    <div className="flex flex-col gap-1 mt-1">
                      {dayTasks.map((t) => (
                        <span
                          key={t.id}
                          onClick={async () => {
                            const res = await api.get(`/tasks/${t.id}`);
                            if (res.success) setSelectedTask(res.data);
                          }}
                          className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 text-[8px] font-bold truncate cursor-pointer hover:bg-sky-500/20"
                        >
                          {t.title}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================================================== */}
        {/* TIMELINE (GANTT) VIEW */}
        {/* ================================================== */}
        {activeTab === 'timeline' && (
          <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-zinc-800 overflow-x-auto">
            <h3 className="text-lg font-bold font-outfit mb-4">Project Timeline (Gantt Chart)</h3>
            <svg className="w-full min-w-[600px] h-[300px] text-xs">
              {/* Draw Timeline Grid Headers (representing weeks) */}
              <line x1="150" y1="0" x2="150" y2="300" stroke="rgba(100, 116, 139, 0.2)" />
              <line x1="280" y1="0" x2="280" y2="300" stroke="rgba(100, 116, 139, 0.2)" />
              <line x1="410" y1="0" x2="410" y2="300" stroke="rgba(100, 116, 139, 0.2)" />
              <line x1="540" y1="0" x2="540" y2="300" stroke="rgba(100, 116, 139, 0.2)" />

              <text x="155" y="15" fill="#64748b" className="font-bold">Week 1</text>
              <text x="285" y="15" fill="#64748b" className="font-bold">Week 2</text>
              <text x="415" y="15" fill="#64748b" className="font-bold">Week 3</text>
              <text x="545" y="15" fill="#64748b" className="font-bold">Week 4</text>

              {/* Draw Task timelines */}
              {tasks.slice(0, 8).map((task, rowIndex) => {
                const y = 40 + rowIndex * 30;
                
                // Map dates relative to start date index
                const startOffset = task.startDate ? (new Date(task.startDate).getDate() % 10) * 12 : 10;
                const spanWidth = task.dueDate && task.startDate
                  ? Math.max(50, ((new Date(task.dueDate).getTime() - new Date(task.startDate).getTime()) / (1000 * 60 * 60 * 24)) * 12)
                  : 120;

                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';

                return (
                  <g key={task.id} className="cursor-pointer" onClick={async () => {
                    const res = await api.get(`/tasks/${task.id}`);
                    if (res.success) setSelectedTask(res.data);
                  }}>
                    {/* Task Title label */}
                    <text x="10" y={y + 12} fill="#64748b" className="font-bold truncate w-28">{task.title.substring(0, 15)}...</text>
                    
                    {/* Gantt Bar */}
                    <rect
                      x={150 + startOffset}
                      y={y}
                      width={spanWidth}
                      height="15"
                      rx="4"
                      fill={isOverdue ? '#ef4444' : task.status === 'COMPLETED' ? '#22c55e' : '#0284c7'}
                      opacity="0.85"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}

        {/* ================================================== */}
        {/* DETAIL DRAWER PANEL */}
        {/* ================================================== */}
        {selectedTask && (
          <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white dark:bg-zinc-900 shadow-2xl border-l border-slate-200 dark:border-zinc-800 z-[999] flex flex-col justify-between p-6">
            <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 text-xs">
              {/* Drawer header */}
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-zinc-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                    {project.name.substring(0, 3).toUpperCase()}-{selectedTask.taskIndex}
                  </span>
                  <h3 className="text-lg font-bold font-outfit mt-1 text-slate-800 dark:text-zinc-100">
                    {selectedTask.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
                >
                  ✕ Close
                </button>
              </div>

              {/* Status Transition & Approval review panel */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-200 dark:border-zinc-800/80 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-500">Task Status:</span>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => handleStatusTransition(selectedTask.id, e.target.value)}
                    className="bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-slate-800 dark:text-white font-bold"
                  >
                    {statuses.map((st) => (
                      <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                {/* Completed Pending Approval Review box */}
                {selectedTask.status === 'WAITING_FOR_REVIEW' && (user?.role.name === 'TEAM_LEAD' || user?.role.name === 'ADMIN') && (
                  <div className="border-t border-slate-200 dark:border-zinc-700/80 pt-3 flex flex-col gap-2.5">
                    <span className="font-bold text-yellow-500 flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Review Task Completion</span>
                    </span>
                    <p className="text-[10px] text-slate-400">Agent marked this task completed. Accept or Reject with comments.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprovalReview(selectedTask.id, true)}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all"
                      >
                        Approve & Close
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt('Enter rejection reason:');
                          if (reason) handleApprovalReview(selectedTask.id, false, reason);
                        }}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* AI assistant metrics */}
              <div className="p-4 bg-sky-500/5 rounded-xl border border-sky-500/10 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sky-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Task Assistant</span>
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => triggerAiSubtasks(selectedTask)}
                      className="px-2.5 py-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      Autogen Subtasks
                    </button>
                    <button
                      onClick={() => triggerAiEstimation(selectedTask)}
                      className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-bold rounded-lg transition-all"
                    >
                      Estimate Risk
                    </button>
                  </div>
                </div>

                {aiSuggestions && (
                  <div className="text-[10px] text-slate-400 flex flex-col gap-2 mt-2 pt-2 border-t border-sky-500/10">
                    {aiSuggestions.loading ? (
                      <span className="animate-pulse">Gemini consulting workload vectors...</span>
                    ) : aiSuggestions.error ? (
                      <span className="text-red-400">{aiSuggestions.error}</span>
                    ) : (
                      <>
                        <p>💡 **Estimated Completion Time**: <span className="text-sky-400 font-bold">{aiSuggestions.estimatedHours} hours</span> (Confidence: {Math.round(aiSuggestions.confidence * 100)}%)</p>
                        <p>⚠️ **Delay Risk Assessment**: <span className="text-red-400 font-bold">{aiSuggestions.risk}</span> ({Math.round(aiSuggestions.delayProbability * 100)}% probability)</p>
                        <p>📖 **Reasoning Details**: {aiSuggestions.reason}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Time logs manual insertion */}
              <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-200 dark:border-zinc-800/80">
                <h4 className="font-bold mb-3 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Manual Time Logger</span>
                </h4>
                <form onSubmit={handleLogHours} className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Hours (e.g. 2.5)"
                    value={timeLogHours}
                    onChange={(e) => setTimeLogHours(e.target.value)}
                    className="w-24 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={timeLogDesc}
                    onChange={(e) => setTimeLogDesc(e.target.value)}
                    className="flex-grow bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-1.5 rounded-lg text-slate-800 dark:text-white"
                  />
                  <button type="submit" className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg">
                    Log
                  </button>
                </form>
              </div>

              {/* Task Comments Feed */}
              <div>
                <h4 className="font-bold mb-3 flex items-center gap-1">
                  <ListTodo className="w-4 h-4 text-slate-400" />
                  <span>Comments & Watchers</span>
                </h4>
                <form onSubmit={handleAddComment} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add comment... (mention users with @name)"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-grow bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                  />
                  <button type="submit" className="p-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg">
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                <div className="flex flex-col gap-3">
                  {(selectedTask.comments || []).map((comm: any) => (
                    <div key={comm.id} className="p-3 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-200 dark:border-zinc-800/50">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700 dark:text-zinc-300">{comm.user?.name}</span>
                        <span className="text-[10px] text-slate-400">{new Date(comm.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-600 dark:text-zinc-400">{comm.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
