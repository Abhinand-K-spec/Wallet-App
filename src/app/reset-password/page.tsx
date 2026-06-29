'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/api/axios';
import { Wallet, KeyRound, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import { logout } from '@/store/authSlice';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const dispatch = useDispatch();

  const handleResetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', { password });
      setSuccess(true);
      dispatch(addToast({ message: 'Password reset successfully!', type: 'success' }));
      // Clear redux auth state if any (just in case)
      dispatch(logout());
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to reset password. Please check your reset link.';
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 font-sans text-gray-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-md w-full bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden hover:border-gray-800/80 transition-all duration-300">
        {/* Branding */}
        <div className="flex justify-center mb-8 h-12 py-1">
          <img src="/logo-no-bg.png" alt="GetPay Logo" className="h-full w-auto object-contain select-none" />
        </div>

        {success ? (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto text-emerald-450 shadow-lg shadow-emerald-500/5">
              <ShieldCheck className="w-8 h-8 text-emerald-450" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Password Reset Successfully</h1>
              <p className="text-gray-400 text-sm leading-relaxed">
                Your password has been updated. You can now use your new password to sign in.
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 transition-all duration-300 shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Sign In with New Password
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">
                Set New Password
              </h1>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                Please enter and confirm your new account password below
              </p>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">
                  New Password
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-indigo-500 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pl-12 font-sans"
                    placeholder="••••••••"
                    required
                  />
                  <KeyRound className="w-5 h-5 text-gray-500 absolute left-4 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">
                  Confirm New Password
                </label>
                <div className="relative group">
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-indigo-500 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pl-12 font-sans"
                    placeholder="••••••••"
                    required
                  />
                  <KeyRound className="w-5 h-5 text-gray-500 absolute left-4 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 transition-all duration-300 flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
