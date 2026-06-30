'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { useRouter } from 'next/navigation';
import { FolderKanban, Plus, Calendar, User, LayoutGrid, List } from 'lucide-react';

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [projectManagerId, setProjectManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    setLoading(true);
    const res = await api.get('/projects');
    if (res.success && res.data) {
      setProjects(res.data);
    }
    setLoading(false);
  };

  const fetchMetadata = async () => {
    // If Admin/Super Admin, fetch candidates & departments for creation
    if (user?.role.name === 'ADMIN' || user?.role.name === 'SUPER_ADMIN') {
      const usersRes = await api.get('/users');
      // For simplicity, we create departments list dynamically or query if endpoint exists. Let's seed departments.
      // Let's create departments fetch
      const usersList = usersRes.success && usersRes.data ? usersRes.data : [];
      setUsers(usersList);
      
      // Filter out unique departments
      const depts = usersList.reduce((acc: any[], u: any) => {
        if (u.department && !acc.some(d => d.id === u.department.id)) {
          acc.push(u.department);
        }
        return acc;
      }, []);
      setDepartments(depts);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchMetadata();
    }
  }, [user]);

  const handleCreateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || !departmentId || !projectManagerId || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    const res = await api.post('/projects', {
      name,
      description,
      departmentId,
      projectManagerId,
      startDate,
      endDate,
    });

    if (res.success) {
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setStartDate('');
      setEndDate('');
      fetchProjects();
    } else {
      setError(res.error?.message || 'Failed to create project');
    }
  };

  const isManager = user?.role.name === 'ADMIN' || user?.role.name === 'SUPER_ADMIN';

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Projects Workspace</h1>
            <p className="text-sm text-slate-500 mt-1">Manage project boards, sprint lanes, and deliverables.</p>
          </div>
          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>New Project</span>
            </button>
          )}
        </div>

        {/* Projects Roster Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs font-semibold animate-pulse">LOADING PROJECTS BOARDS...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
            <FolderKanban className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <h3 className="font-bold text-lg">No projects logged</h3>
            <p className="text-xs text-slate-500 mt-1">Projects created for your department will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => router.push(`/projects/${proj.id}`)}
                className="glass-panel rounded-2xl p-5 glass-card-hover cursor-pointer border border-slate-200 dark:border-zinc-800/80 flex flex-col justify-between min-h-[180px]"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-lg font-outfit text-slate-800 dark:text-zinc-100 truncate">
                      {proj.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 text-[9px] font-bold uppercase border border-sky-500/20">
                      {proj.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-2 leading-relaxed">
                    {proj.description || 'No description supplied.'}
                  </p>
                </div>

                <div className="border-t border-slate-100 dark:border-zinc-800 pt-4 mt-4 flex justify-between items-center text-[10px] text-slate-400">
                  <div className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>PM: {proj.projectManager?.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Due: {new Date(proj.endDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="glass-panel w-full max-w-lg p-6 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl relative">
              <button
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
              <h3 className="text-xl font-bold font-outfit mb-4">Create Project board</h3>
              
              {error && <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded mb-4">{error}</p>}
              
              <form onSubmit={handleCreateProjectSubmit} className="flex flex-col gap-4 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WorkFlow Pro Frontend"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-semibold text-slate-500">Description</label>
                  <textarea
                    placeholder="Describe scope, objectives, and parameters..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">Department *</label>
                    <select
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">Project Manager *</label>
                    <select
                      value={projectManagerId}
                      onChange={(e) => setProjectManagerId(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                    >
                      <option value="">Select PM</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.designation})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">Start Date *</label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-semibold text-slate-500">End Date *</label>
                    <input
                      type="date"
                      required
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-lg transition-all shadow-lg shadow-sky-500/20"
                >
                  Create Board
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
