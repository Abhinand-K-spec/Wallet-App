'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { loginSuccess } from '@/store/authSlice';
import { addToast } from '@/store/toastSlice';
import type { RootState } from '@/store/store';
import api from '@/api/axios';
import { Wallet, KeyRound, AlertCircle, Loader2, Zap, ShieldCheck, TrendingUp } from 'lucide-react';

const LoginPage = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegistering ? '/auth/register' : '/auth/login';
      const payload = isRegistering 
        ? { email: identifier, password } 
        : { identifier, password };
      
      const response = await api.post(endpoint, payload);
      const { user, token } = response.data;
      
      dispatch(loginSuccess({ user, token }));
      dispatch(addToast({ 
        message: isRegistering ? 'Account registered successfully!' : 'Signed in successfully!', 
        type: 'success' 
      }));
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || `Failed to ${isRegistering ? 'register' : 'login'}`;
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-gray-950 font-sans text-gray-100 overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Left Column: Visual/Marketing Panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-b from-gray-900 via-gray-950 to-indigo-950/20 border-r border-gray-800/60 p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        
        {/* Top Branding */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="bg-indigo-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 border border-indigo-400/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-black bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">GetPay</span>
        </div>

        {/* Center Content */}
        <div className="space-y-8 my-auto relative z-10 max-w-sm">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/20 inline-block">Next-Gen Gateway</span>
            <h2 className="text-4xl font-extrabold text-white leading-tight">
              Instantly convert <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">USDT to INR</span> with zero friction.
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Scan, deposit, and withdraw. Experience the premium gateway for TRC20 and ERC20 stablecoins.
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-800/80">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0 mt-0.5 border border-indigo-500/10">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-200">Real-Time Processing</h4>
                <p className="text-xs text-gray-500 mt-0.5">Automated on-chain status tracking and dynamic settlement rates.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0 mt-0.5 border border-indigo-500/10">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-200">Bank-Grade Protection</h4>
                <p className="text-xs text-gray-500 mt-0.5">Dual layers of authentication and verified blockchain confirmation hash logs.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400 shrink-0 mt-0.5 border border-indigo-500/10">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-200">Dynamic Rates Integration</h4>
                <p className="text-xs text-gray-500 mt-0.5">Track exchange markets instantly with periodic local update triggers.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-gray-500 flex items-center justify-between">
          <span>© {new Date().getFullYear()} GetPay. All rights reserved.</span>
          <span className="flex items-center gap-1.5 hover:text-gray-400 cursor-pointer">Security verified <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /></span>
        </div>
      </div>

      {/* Right Column: Authentication Card Form */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="max-w-md w-full bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden hover:border-gray-800/80 transition-all duration-300">
          
          {/* Mobile branding */}
          <div className="flex items-center gap-2 justify-center lg:hidden mb-6">
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg border border-indigo-400/20">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">GetPay</span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">
              {isRegistering ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className="text-gray-400 text-xs mt-2 leading-relaxed">
              {isRegistering ? 'Create a secure wallet account to start sending & receiving payments' : 'Enter your credentials to access your secure payment dashboard'}
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">
                {isRegistering ? 'Email Address' : 'Email or User ID'}
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-indigo-500 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pl-12 font-sans"
                  placeholder="email@example.com"
                  required
                />
                <Wallet className="w-5 h-5 text-gray-500 absolute left-4 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">Password</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 transition-all duration-300 flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Register Secure Account' : 'Sign In to Dashboard')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setIdentifier('');
                setPassword('');
                setError('');
              }}
              className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors cursor-pointer"
            >
              {isRegistering ? 'Already have an account? Sign In' : 'Need an account? Register Here'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
