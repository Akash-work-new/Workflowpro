'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  designation: string;
  status: string;
  role: { id: string; name: string };
  department?: { id: string; name: string } | null;
  createdAt?: string;
}

interface Role { id: string; name: string; }
interface Department { id: string; name: string; }

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'from-purple-500 to-pink-500',
  ADMIN: 'from-blue-500 to-cyan-500',
  TEAM_LEAD: 'from-emerald-500 to-teal-500',
  AGENT: 'from-orange-500 to-amber-500',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  INACTIVE: '#ef4444',
  ON_LEAVE: '#f59e0b',
};

export default function AdminControlPanelPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'reset'>('users');

  // Create User form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', email: '', password: '', roleName: 'AGENT',
    designation: '', departmentId: '', phoneNumber: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Factory Reset
  const [resetStep, setResetStep] = useState(0); // 0=idle, 1=confirm1, 2=confirm2, 3=typing
  const [resetPhrase, setResetPhrase] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes, depsRes] = await Promise.all([
        api.get('/users'),
        api.get('/users/roles'),
        api.get('/users/departments'),
      ]);
      if (usersRes.success) setUsers(usersRes.data);
      if (rolesRes.success) setRoles(rolesRes.data);
      if (depsRes.success) setDepartments(depsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role?.name !== 'SUPER_ADMIN' && user?.role?.name !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetchData();
  }, [user, router, fetchData]);

  // ── Create User ──────────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await api.post('/users', createForm);
      if (res.success) {
        showToast(`✅ User "${res.data.name}" created with ID ${res.data.employeeId}`, 'success');
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', password: '', roleName: 'AGENT', designation: '', departmentId: '', phoneNumber: '' });
        fetchData();
      } else {
        setCreateError(res.error?.message || 'Failed to create user');
      }
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Delete User ──────────────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await api.delete(`/users/${deleteTarget.id}`);
      if (res.success) {
        showToast(`🗑️ User "${deleteTarget.name}" has been removed.`, 'success');
        setDeleteTarget(null);
        fetchData();
      } else {
        showToast(res.error?.message || 'Delete failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Toggle User Status ───────────────────────────────────────────────────
  const handleToggleStatus = async (u: User) => {
    const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await api.put(`/users/${u.id}/status`, { status: newStatus });
      if (res.success) {
        showToast(`User ${u.name} is now ${newStatus}`, 'success');
        fetchData();
      }
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  // ── Factory Reset ────────────────────────────────────────────────────────
  const handleFactoryReset = async () => {
    if (resetPhrase !== 'RESET ALL DATA') {
      showToast('Incorrect confirmation phrase.', 'error');
      return;
    }
    setResetLoading(true);
    try {
      const res = await api.post('/users/admin/factory-reset', { confirmationPhrase: 'RESET ALL DATA' });
      if (res.success) {
        setResetSuccess(true);
        setResetStep(0);
        setResetPhrase('');
        fetchData();
      } else {
        showToast(res.error?.message || 'Reset failed', 'error');
      }
    } catch {
      showToast('Network error', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  if (user?.role?.name !== 'SUPER_ADMIN' && user?.role?.name !== 'ADMIN') return null;

  return (
    <DashboardLayout>
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f0a 100%)', padding: '32px' }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
            background: toast.type === 'success' ? 'linear-gradient(135deg, #064e3b, #065f46)' : 'linear-gradient(135deg, #7f1d1d, #991b1b)',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
            borderRadius: '12px', padding: '16px 24px', color: '#fff',
            fontSize: '14px', fontWeight: 600, boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            animation: 'slideIn 0.3s ease', maxWidth: '400px',
          }}>
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
            }}>⚙️</div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>
                {user?.role?.name === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} Control Panel
              </h1>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '2px 0 0' }}>
                Full system control — user management &amp; data administration
              </p>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '24px', flexWrap: 'wrap' }}>
            {[
              { label: 'Total Users', value: users.length, icon: '👥', color: '#7c3aed' },
              { label: 'Active', value: users.filter(u => u.status === 'ACTIVE').length, icon: '✅', color: '#10b981' },
              { label: 'Inactive', value: users.filter(u => u.status === 'INACTIVE').length, icon: '⛔', color: '#ef4444' },
              { label: 'Departments', value: departments.length, icon: '🏢', color: '#3b82f6' },
              { label: 'Roles', value: roles.length, icon: '🔑', color: '#f59e0b' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px',
                padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span style={{ fontSize: '20px' }}>{stat.icon}</span>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {[
            { key: 'users', label: '👥 User Management' },
            ...(user?.role?.name === 'SUPER_ADMIN' ? [{ key: 'reset', label: '💣 Factory Reset' }] : []),
          ].map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
              padding: '10px 24px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '14px', transition: 'all 0.2s',
              background: activeTab === tab.key
                ? tab.key === 'reset' ? 'linear-gradient(135deg, #7f1d1d, #dc2626)' : 'linear-gradient(135deg, #4c1d95, #7c3aed)'
                : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.key ? '#fff' : '#9ca3af',
              boxShadow: activeTab === tab.key ? '0 4px 16px rgba(124,58,237,0.3)' : 'none',
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── USER MANAGEMENT TAB ─────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: 0 }}>
                All Users ({users.length})
              </h2>
              <button onClick={() => setShowCreateModal(true)} style={{
                padding: '10px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #4c1d95, #7c3aed)',
                color: '#fff', fontWeight: 600, fontSize: '14px',
                boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'transform 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span style={{ fontSize: '16px' }}>+</span> Add New User
              </button>
            </div>

            {/* User Table */}
            <div style={{
              background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden',
            }}>
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'pulse 1s infinite' }}>⏳</div>
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#6b7280' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>👤</div>
                  No users found. Create one below!
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Employee', 'Email', 'Designation', 'Role', 'Department', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{
                          padding: '14px 16px', textAlign: 'left',
                          fontSize: '12px', fontWeight: 700, color: '#6b7280',
                          letterSpacing: '0.5px', textTransform: 'uppercase',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} style={{
                        borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        transition: 'background 0.15s',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '10px',
                              background: `linear-gradient(135deg, ${ROLE_COLORS[u.role?.name] || 'from-gray-500 to-gray-600'})`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '14px', fontWeight: 700, color: '#fff',
                              backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                            }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{u.name}</div>
                              <div style={{ color: '#6b7280', fontSize: '12px' }}>{u.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '14px' }}>{u.email}</td>
                        <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '14px' }}>{u.designation}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                            background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)',
                          }}>
                            {u.role?.name?.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#9ca3af', fontSize: '14px' }}>
                          {u.department?.name || '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                            background: `${STATUS_COLORS[u.status]}20`, color: STATUS_COLORS[u.status],
                            border: `1px solid ${STATUS_COLORS[u.status]}40`,
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[u.status] }} />
                            {u.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {u.role?.name !== 'SUPER_ADMIN' && (
                              <>
                                <button onClick={() => handleToggleStatus(u)} title={u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} style={{
                                  padding: '6px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px',
                                  background: u.status === 'ACTIVE' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                  color: u.status === 'ACTIVE' ? '#ef4444' : '#10b981',
                                  fontWeight: 600, transition: 'all 0.2s',
                                }}>
                                  {u.status === 'ACTIVE' ? '⛔ Deactivate' : '✅ Activate'}
                                </button>
                                <button onClick={() => setDeleteTarget(u)} title="Delete user" style={{
                                  padding: '6px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                  background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '14px', transition: 'all 0.2s',
                                }}>
                                  🗑️
                                </button>
                              </>
                            )}
                            {u.role?.name === 'SUPER_ADMIN' && (
                              <span style={{ color: '#6b7280', fontSize: '12px', fontStyle: 'italic' }}>Protected</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── FACTORY RESET TAB ───────────────────────────────────────────── */}
        {activeTab === 'reset' && (
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            {resetSuccess ? (
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '20px', padding: '48px', textAlign: 'center',
              }}>
                <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
                <h2 style={{ color: '#10b981', fontSize: '24px', fontWeight: 800, margin: '0 0 8px' }}>
                  Factory Reset Complete
                </h2>
                <p style={{ color: '#6b7280', fontSize: '16px', margin: '0 0 24px' }}>
                  All operational data has been wiped. The system is now fresh and clean.
                  Your Super Admin account is preserved.
                </p>
                <button onClick={() => setResetSuccess(false)} style={{
                  padding: '12px 28px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #064e3b, #10b981)', color: '#fff', fontWeight: 700,
                }}>
                  Go Back to Panel
                </button>
              </div>
            ) : (
              <>
                {/* Warning Card */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(127,29,29,0.4), rgba(153,27,27,0.2))',
                  border: '1px solid rgba(239,68,68,0.4)', borderRadius: '20px', padding: '32px',
                  marginBottom: '24px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '16px', fontSize: '28px',
                      background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(239,68,68,0.4)',
                    }}>💣</div>
                    <div>
                      <h2 style={{ color: '#fca5a5', fontSize: '22px', fontWeight: 800, margin: 0 }}>
                        Factory Reset
                      </h2>
                      <p style={{ color: '#f87171', fontSize: '14px', margin: '4px 0 0' }}>
                        Irreversible · Permanent · Total data wipe
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                    <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '14px', margin: '0 0 12px' }}>
                      ⚠️ This action will permanently delete:
                    </p>
                    {['All tasks and subtasks', 'All projects and sprints', 'All teams and members',
                      'All time logs and performance records', 'All audit logs and notifications',
                      'All comments, attachments and reports', 'All users (except your Super Admin account)'].map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ color: '#ef4444', fontSize: '12px' }}>✕</span>
                        <span style={{ color: '#fca5a5', fontSize: '14px' }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '14px' }}>
                    <p style={{ color: '#6ee7b7', fontSize: '13px', margin: 0 }}>
                      ✅ <strong>Preserved:</strong> Your Super Admin account · System roles · Department structure
                    </p>
                  </div>
                </div>

                {/* Step-by-step confirmation */}
                {resetStep === 0 && (
                  <button onClick={() => setResetStep(1)} style={{
                    width: '100%', padding: '16px', borderRadius: '14px', border: '2px solid rgba(239,68,68,0.4)',
                    background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: '16px', fontWeight: 700,
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; e.currentTarget.style.borderColor = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)'; }}
                  >
                    🔴 Initiate Factory Reset
                  </button>
                )}

                {resetStep === 1 && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '28px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p style={{ color: '#fbbf24', fontWeight: 700, fontSize: '16px', margin: '0 0 8px', textAlign: 'center' }}>
                      ⚠️ Are you absolutely sure?
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 24px', textAlign: 'center' }}>
                      This will immediately and permanently delete all data. There is no undo.
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => setResetStep(0)} style={{
                        flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                        background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                      <button onClick={() => setResetStep(2)} style={{
                        flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                        background: 'linear-gradient(135deg, #7f1d1d, #dc2626)', color: '#fff', fontWeight: 700, cursor: 'pointer',
                      }}>
                        Yes, I&apos;m Sure
                      </button>
                    </div>
                  </div>
                )}

                {resetStep === 2 && (
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '28px', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <p style={{ color: '#fca5a5', fontWeight: 700, fontSize: '15px', margin: '0 0 8px', textAlign: 'center' }}>
                      🔐 Final Confirmation Required
                    </p>
                    <p style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 20px', textAlign: 'center' }}>
                      Type exactly: <strong style={{ color: '#ef4444', fontFamily: 'monospace' }}>RESET ALL DATA</strong>
                    </p>
                    <input
                      value={resetPhrase}
                      onChange={e => setResetPhrase(e.target.value)}
                      placeholder="Type confirmation phrase here..."
                      style={{
                        width: '100%', padding: '14px 16px', borderRadius: '10px', fontSize: '16px',
                        background: 'rgba(0,0,0,0.4)', border: `2px solid ${resetPhrase === 'RESET ALL DATA' ? '#10b981' : 'rgba(239,68,68,0.4)'}`,
                        color: '#fff', outline: 'none', marginBottom: '16px', boxSizing: 'border-box',
                        fontFamily: 'monospace', textAlign: 'center', letterSpacing: '2px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button onClick={() => { setResetStep(0); setResetPhrase(''); }} style={{
                        flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                        background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer',
                      }}>
                        Cancel
                      </button>
                      <button
                        onClick={handleFactoryReset}
                        disabled={resetPhrase !== 'RESET ALL DATA' || resetLoading}
                        style={{
                          flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                          background: resetPhrase === 'RESET ALL DATA'
                            ? 'linear-gradient(135deg, #7f1d1d, #dc2626)'
                            : 'rgba(255,255,255,0.05)',
                          color: resetPhrase === 'RESET ALL DATA' ? '#fff' : '#4b5563',
                          fontWeight: 700, cursor: resetPhrase === 'RESET ALL DATA' ? 'pointer' : 'not-allowed',
                          transition: 'all 0.2s',
                        }}
                      >
                        {resetLoading ? '⏳ Resetting...' : '💣 Execute Reset'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CREATE USER MODAL ─────────────────────────────────────────────── */}
        {showCreateModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #111827, #1f2937)',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: '24px',
              padding: '36px', width: '100%', maxWidth: '520px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
              animation: 'slideUp 0.3s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
                <div>
                  <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: 0 }}>Create New User</h2>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Add a new team member to the platform</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} style={{
                  width: '36px', height: '36px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', color: '#9ca3af', fontSize: '18px',
                }}>×</button>
              </div>

              {createError && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '10px', padding: '12px 16px', marginBottom: '20px',
                  color: '#fca5a5', fontSize: '14px',
                }}>
                  ⚠️ {createError}
                </div>
              )}

              <form onSubmit={handleCreateUser}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {[
                    { label: 'Full Name *', key: 'name', type: 'text', placeholder: 'John Smith' },
                    { label: 'Email Address *', key: 'email', type: 'email', placeholder: 'john@company.com' },
                    { label: 'Password *', key: 'password', type: 'password', placeholder: 'Min 8 characters' },
                    { label: 'Phone Number', key: 'phoneNumber', type: 'tel', placeholder: '+91 9876543210' },
                    { label: 'Designation *', key: 'designation', type: 'text', placeholder: 'Senior Developer' },
                  ].map(field => (
                    <div key={field.key} style={{ gridColumn: field.key === 'designation' ? '1 / -1' : undefined }}>
                      <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={(createForm as any)[field.key]}
                        onChange={e => setCreateForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder={field.placeholder}
                        required={field.label.includes('*')}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: '10px',
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                          color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Role *
                    </label>
                    <select
                      value={createForm.roleName}
                      onChange={e => setCreateForm(prev => ({ ...prev, roleName: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      {roles.filter(r => r.name !== 'SUPER_ADMIN').map(r => (
                        <option key={r.id} value={r.name} style={{ background: '#1f2937' }}>{r.name.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#9ca3af', fontSize: '12px', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Department
                    </label>
                    <select
                      value={createForm.departmentId}
                      onChange={e => setCreateForm(prev => ({ ...prev, departmentId: e.target.value }))}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                        color: '#fff', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                      }}
                    >
                      <option value="" style={{ background: '#1f2937' }}>— None —</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id} style={{ background: '#1f2937' }}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setShowCreateModal(false)} style={{
                    flex: 1, padding: '13px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer', fontSize: '14px',
                  }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={createLoading} style={{
                    flex: 2, padding: '13px', borderRadius: '12px', border: 'none',
                    background: createLoading ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg, #4c1d95, #7c3aed)',
                    color: '#fff', fontWeight: 700, cursor: createLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px', boxShadow: '0 4px 16px rgba(124,58,237,0.4)',
                  }}>
                    {createLoading ? '⏳ Creating...' : '✨ Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────────── */}
        {deleteTarget && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #111827, #1f2937)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '20px',
              padding: '32px', width: '100%', maxWidth: '400px',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
            }}>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🗑️</div>
                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: '0 0 8px' }}>Delete User?</h2>
                <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
                  This will permanently remove <strong style={{ color: '#fca5a5' }}>{deleteTarget.name}</strong> ({deleteTarget.email}) from the platform. This cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setDeleteTarget(null)} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: '#9ca3af', fontWeight: 600, cursor: 'pointer',
                }}>
                  Cancel
                </button>
                <button onClick={handleDeleteUser} disabled={deleteLoading} style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #7f1d1d, #dc2626)',
                  color: '#fff', fontWeight: 700, cursor: 'pointer',
                }}>
                  {deleteLoading ? '⏳ Deleting...' : '🗑️ Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideIn { from { opacity:0; transform: translateX(20px); } to { opacity:1; transform: translateX(0); } }
          @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
          @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
          input::placeholder { color: #4b5563; }
          select option { color: #fff; background: #1f2937; }
        `}</style>
      </div>
    </DashboardLayout>
  );
}
