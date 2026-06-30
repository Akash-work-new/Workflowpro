'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { FileDown, ShieldCheck, FileSpreadsheet, AlertTriangle, Users } from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState('employee-productivity');
  const [format, setFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleDownloadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = localStorage.getItem('accessToken');
    if (!token) {
      setMessage('Session invalid. Please log in.');
      setLoading(false);
      return;
    }

    try {
      const url = `http://localhost:5000/api/reports/export?reportType=${reportType}&format=${format}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate report from server.');
      }

      // Read as binary blob
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Determine file extension
      const ext = format === 'pdf' ? 'pdf' : format === 'excel' ? 'xlsx' : 'csv';
      
      // Create hidden link and click it
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${reportType}-report-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      setMessage('Report generated and downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      setMessage(err.message || 'Failed to download report.');
    } finally {
      setLoading(false);
    }
  };

  const reportCategories = [
    { id: 'employee-productivity', name: 'Employee Productivity', desc: 'Active logs, tasks completion rate, and speed metrics.', icon: Users },
    { id: 'project-progress', name: 'Project Progress & Health', desc: 'Timeline statistics, sprints health, and completion ratios.', icon: FileSpreadsheet },
    { id: 'overdue-tasks', name: 'Overdue Action Items', desc: 'Details of all pending tasks that exceeded scheduled due dates.', icon: AlertTriangle },
    { id: 'task-completion', name: 'General Tasks Analytics', desc: 'Raw task database entries with priorities and logged actual hours.', icon: ShieldCheck },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full text-xs">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Reports Exporter</h1>
            <p className="text-sm text-slate-500 mt-1">Export structured analytics sheets, spreadsheets, and document scorecards.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Configuration form */}
          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 h-fit">
            <h3 className="text-base font-bold font-outfit mb-4">Export Settings</h3>
            
            {message && (
              <p className="text-xs text-sky-500 bg-sky-500/5 p-2.5 rounded border border-sky-500/20 mb-4">
                {message}
              </p>
            )}

            <form onSubmit={handleDownloadReport} className="flex flex-col gap-6">
              {/* Category selector */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-slate-500">Report Category *</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reportCategories.map((c) => {
                    const Icon = c.icon;
                    const selected = reportType === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setReportType(c.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all flex gap-3 ${
                          selected
                            ? 'border-sky-500 bg-sky-500/5 shadow-md shadow-sky-500/5'
                            : 'border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className={`p-2.5 rounded-lg ${selected ? 'bg-sky-500/10 text-sky-500' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-zinc-100">{c.name}</h4>
                          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{c.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Format selection */}
              <div className="flex flex-col gap-2">
                <label className="font-semibold text-slate-500">Export Format *</label>
                <div className="flex gap-4">
                  {['pdf', 'excel', 'csv'].map((fmt) => {
                    const selected = format === fmt;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormat(fmt)}
                        className={`px-6 py-2.5 rounded-xl font-bold uppercase border transition-all ${
                          selected
                            ? 'bg-sky-500 text-white border-sky-500 shadow-md shadow-sky-500/10'
                            : 'bg-white dark:bg-zinc-950 text-slate-500 border-slate-200 dark:border-zinc-800 hover:bg-slate-50'
                        }`}
                      >
                        {fmt === 'excel' ? 'Excel (.xlsx)' : fmt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 py-3 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-sky-500/20 transition-all"
              >
                <FileDown className="w-4 h-4" />
                <span>{loading ? 'Compiling Report...' : 'Compile & Export'}</span>
              </button>
            </form>
          </div>

          {/* Right: Info Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 h-fit flex flex-col gap-3">
            <h4 className="font-bold text-sm">Report Compliance</h4>
            <p className="text-slate-500 leading-relaxed">
              WorkFlow Pro exports strictly comply with auditing and security configurations. Every download event is automatically tracked and written to the system audit logs. 
            </p>
            <div className="p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl text-yellow-500 text-[10px] leading-relaxed">
              ⚠️ Large report sets may take up to 10 seconds to compile PDF layout pages.
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
