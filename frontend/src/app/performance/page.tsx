'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { Award, Trophy, Users, Star, ArrowUpRight, TrendingUp, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function PerformancePage() {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [employeeStats, setEmployeeStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [managerFeedback, setManagerFeedback] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);

  const fetchPerformanceData = async () => {
    setLoading(true);
    const leadRes = await api.get('/dashboard/leaderboard');
    if (leadRes.success && leadRes.data) {
      setLeaderboard(leadRes.data);
    }
    
    const statsRes = await api.get('/dashboard/employee');
    if (statsRes.success && statsRes.data) {
      setEmployeeStats(statsRes.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchPerformanceData();
  }, [user]);

  if (loading || !employeeStats) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-slate-400 text-xs font-semibold animate-pulse">LOADING PERFORMANCE SYSTEMS...</div>
      </DashboardLayout>
    );
  }

  const { metrics } = employeeStats;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 w-full">
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-extrabold font-outfit tracking-tight">Performance & Gamification</h1>
            <p className="text-sm text-slate-500 mt-1">Track employee productivity indexes, reviews, and monthly rankings.</p>
          </div>
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Personal Scorecard */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Scorecard indicators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                <div className="p-3 bg-sky-500/10 text-sky-500 rounded-xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Productivity Score</span>
                  <span className="text-2xl font-bold text-sky-500">{metrics.productivityScore}%</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                  <Star className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Efficiency Score</span>
                  <span className="text-2xl font-bold text-indigo-500">{metrics.efficiencyScore}%</span>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 flex items-center gap-4">
                <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase block">Timely completions</span>
                  <span className="text-2xl font-bold text-green-500">{metrics.onTimeCompletionPercentage}%</span>
                </div>
              </div>
            </div>

            {/* Performance charts */}
            <div className="glass-panel p-6 rounded-2xl">
              <h3 className="text-base font-bold font-outfit mb-4">Task metrics comparison</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: 'Productivity', score: metrics.productivityScore },
                      { name: 'Efficiency', score: metrics.efficiencyScore },
                      { name: 'Timeliness', score: metrics.onTimeCompletionPercentage },
                    ]}
                  >
                    <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: '#121218', border: '1px solid #27272a', borderRadius: '8px' }} />
                    <Bar dataKey="score" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Right Column: Gamified Leaderboard */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 flex flex-col gap-4">
            <h3 className="text-lg font-bold font-outfit flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <span>Monthly Leaderboard</span>
            </h3>

            {leaderboard.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No leaderboard logs recorded.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {leaderboard.map((agent, index) => {
                  const isTop3 = index < 3;
                  return (
                    <div
                      key={agent.userId}
                      className={`p-3 rounded-xl flex items-center justify-between transition-all ${
                        isTop3
                          ? 'bg-gradient-to-r from-sky-500/5 to-transparent border border-sky-500/10'
                          : 'border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0
                            ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
                            : index === 1
                            ? 'bg-slate-300/10 text-slate-400 border border-slate-300/30'
                            : index === 2
                            ? 'bg-amber-600/10 text-amber-600 border border-amber-600/30'
                            : 'text-slate-400'
                        }`}>
                          {index + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-200">{agent.userName}</h4>
                          <span className="text-[10px] text-slate-400">{agent.designation}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-sky-400 text-xs">{agent.score} pts</span>
                        <span className="text-[9px] text-slate-400 block">{agent.completedCount} resolved</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
