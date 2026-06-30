'use client';

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, ShieldAlert, Sparkles, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const { login, verify2FA } = useAuth();
  const router = useRouter();

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');

  // Password reset helper states
  const [resetEmail, setResetEmail] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.success && res.data) {
        if (res.data.twoFactorRequired && res.data.tempToken) {
          setTwoFactorRequired(true);
          setTempToken(res.data.tempToken);
        } else {
          router.push('/dashboard');
        }
      } else {
        setError(res.error?.message || 'Login failed. Please verify credentials.');
      }
    } catch (err) {
      setError('Connection refused. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await verify2FA(otpToken, tempToken, false);
      if (res.success) {
        router.push('/dashboard');
      } else {
        setError(res.error?.message || 'Invalid code. Try again.');
      }
    } catch (err) {
      setError('An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    if (!resetEmail) return;

    const res = await api.post('/auth/forgot-password', { email: resetEmail });
    if (res.success && res.data) {
      setResetMessage(res.data.message);
      if (res.data.resetToken) {
        // Dev helper alert
        alert(`Dev Mode: Reset Token is: ${res.data.resetToken}`);
      }
    } else {
      setResetMessage('Failed to trigger reset link.');
    }
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center bg-zinc-950 text-white overflow-hidden font-sans">
      {/* Decorative Gradient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="glass-panel w-full max-w-md p-8 rounded-2xl shadow-2xl relative z-10 border border-zinc-800 bg-zinc-900/60 backdrop-blur-lg">
        {/* Logo header */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="p-3 bg-sky-500/10 rounded-xl border border-sky-500/30 text-sky-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-outfit tracking-tight">
            {twoFactorRequired ? 'Two-Factor Authentication' : 'Welcome to WorkFlow Pro'}
          </h2>
          <p className="text-zinc-400 text-xs text-center">
            {twoFactorRequired
              ? 'Enter the 6-digit authorization code from your authenticator'
              : 'Enter credentials to access your enterprise dashboard'}
          </p>
        </div>

        {/* Errors display */}
        {error && (
          <div className="mb-5 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex gap-2 items-center">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2FA Form or Standard Login Form */}
        {!twoFactorRequired ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs font-semibold">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  placeholder="name@workflowpro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-800/80 text-sm pl-9 pr-4 py-2.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-white placeholder-zinc-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-zinc-400 text-xs font-semibold">Password</label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-sky-400 hover:text-sky-300 text-xs hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-800/80 text-sm pl-9 pr-4 py-2.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-white placeholder-zinc-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2"
            >
              {loading ? 'Authenticating...' : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Log In</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handle2FASubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-zinc-400 text-xs font-semibold">6-Digit Code</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="000 000"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value)}
                  className="w-full bg-zinc-800/80 text-sm pl-9 pr-4 py-2.5 rounded-lg border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500 text-white tracking-widest text-center placeholder-zinc-600 font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 mt-2 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
            >
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>

            <button
              type="button"
              onClick={() => {
                setTwoFactorRequired(false);
                setOtpToken('');
              }}
              className="text-xs text-zinc-400 hover:text-white underline mt-2 text-center"
            >
              Back to credentials login
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-sm p-6 bg-zinc-900 border border-zinc-800 rounded-xl relative shadow-2xl">
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold font-outfit mb-2">Reset Password</h3>
            <p className="text-zinc-400 text-xs mb-4">
              Enter your email address and we will generate a password reset token.
            </p>
            {resetMessage && (
              <p className="text-sky-400 text-xs bg-sky-500/5 p-2 rounded border border-sky-500/20 mb-4">
                {resetMessage}
              </p>
            )}
            <form onSubmit={handleForgotPassword} className="flex flex-col gap-3">
              <input
                type="email"
                required
                placeholder="name@workflowpro.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-white"
              />
              <button
                type="submit"
                className="w-full py-2 bg-sky-500 hover:bg-sky-600 text-white font-semibold text-xs rounded-lg transition-all"
              >
                Send Reset Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
