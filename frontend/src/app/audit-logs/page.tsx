'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { History, ShieldAlert, Cpu } from 'lucide-react';

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = async () => {
    setLoading(true);
    const res = await api.get('/audit-logs');
    if (res.success && res.data) {
      setLogs(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user && user.role?.name === 'SUPER_ADMIN') {
      fetchAuditLogs();
    }
  }, [user, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-zinc-950 flex items-center justify-center text-white font-bold animate-pulse text-xs">
        AUTHENTICATING SESSION...
      </div>
    );
  }

  if (!user || user.role?.name !== 'SUPER_ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
          <h3 className="text-lg font-bold">Access Denied</h3>
          <p className="text-xs text-slate-500 mt-1">Only Super Administrators have authorized clearance to view system logs.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-xs">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Security Audit Logs</h1>
            <p className="text-sm text-slate-500 mt-1">Immutable chronicle of system configurations and user actions.</p>
          </div>
          <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1.5 rounded-xl font-bold">
            <Cpu className="w-4 h-4" />
            <span>Immutable Archive</span>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-semibold animate-pulse">QUERYING AUDIT STREAM...</div>
        ) : logs.length === 0 ? (
          <p className="text-center py-12 text-slate-500">No logs found.</p>
        ) : (
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-zinc-900/80 text-slate-400 font-bold border-b border-slate-200 dark:border-zinc-800 uppercase">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-200 dark:border-zinc-800/85 hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all font-mono text-[10px]"
                  >
                    <td className="p-4 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-4 font-bold text-slate-700 dark:text-zinc-300">
                      {log.user?.name || 'System / Unauth'}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 font-bold border border-sky-500/20">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 dark:text-zinc-400">{log.ipAddress}</td>
                    <td className="p-4 text-slate-500 dark:text-zinc-400 max-w-xs truncate" title={JSON.stringify(log.details)}>
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
