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

  // Forgot Password States
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // OTP States
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  
  const dispatch = useDispatch();
  const router = useRouter();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

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
      
      if (response.data.requiresVerification) {
        setOtpEmail(response.data.email);
        setShowOtpScreen(true);
        setOtpTimer(30);
        dispatch(addToast({ 
          message: 'Verification code sent to your email!', 
          type: 'success' 
        }));
      } else {
        const { user, token } = response.data;
        dispatch(loginSuccess({ user, token }));
        dispatch(addToast({ 
          message: isRegistering ? 'Account registered successfully!' : 'Signed in successfully!', 
          type: 'success' 
        }));
        router.push('/dashboard');
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || `Failed to ${isRegistering ? 'register' : 'login'}`;
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setForgotSuccess('');
    setForgotLoading(true);

    try {
      await api.post('/auth/forgot-password', { email: forgotEmail });
      setForgotSuccess('A password reset link has been sent to your email.');
      dispatch(addToast({ message: 'Password reset link sent!', type: 'success' }));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to request password reset';
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpLoading(true);

    const otpCode = otpValues.join('');
    if (otpCode.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      setOtpLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/verify-otp', {
        email: otpEmail,
        token: otpCode,
        password: password,
      });

      const { user, token } = response.data;
      dispatch(loginSuccess({ user, token }));
      dispatch(addToast({ 
        message: 'Email verified and account registered successfully!', 
        type: 'success' 
      }));
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'OTP verification failed';
      setOtpError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setOtpError('');
    try {
      await api.post('/auth/resend-otp', { email: otpEmail });
      setOtpTimer(30);
      dispatch(addToast({ message: 'Verification code resent successfully!', type: 'success' }));
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to resend code';
      setOtpError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value && isNaN(Number(value))) return;
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value.substring(value.length - 1);
    setOtpValues(newOtpValues);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
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
            <span className="text-xs font-bold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-3 py-1.5 rounded-full border border-indigo-500/20 inline-block">
              {showOtpScreen ? 'Email Verification' : 'Next-Gen Gateway'}
            </span>
            <h2 className="text-4xl font-extrabold text-white leading-tight">
              {showOtpScreen ? (
                <span>Confirm your <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">secure login</span> email.</span>
              ) : (
                <span>Instantly convert <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">USDT to INR</span> with zero friction.</span>
              )}
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              {showOtpScreen ? (
                'Please check your inbox for a 6-digit confirmation code. Enter the code to unlock your dashboard.'
              ) : (
                'Scan, deposit, and withdraw. Experience the premium gateway for TRC20 stablecoins.'
              )}
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
        {showOtpScreen ? (
          <div className="max-w-md w-full bg-gray-900/60 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            {/* Mobile branding */}
            <div className="flex items-center gap-2 justify-center lg:hidden mb-6">
              <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg border border-indigo-400/20">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">GetPay</span>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-white via-gray-200 to-indigo-400 bg-clip-text text-transparent">
                Verify Email
              </h1>
              <p className="text-gray-400 text-xs mt-2.5 leading-relaxed">
                Enter the 6-digit verification code sent to <br />
                <span className="text-indigo-400 font-semibold font-mono">{otpEmail}</span>
              </p>
            </div>

            {otpError && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-semibold leading-relaxed">{otpError}</p>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-between gap-2.5">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    id={`otp-${idx}`}
                    type="text"
                    pattern="\d*"
                    maxLength={1}
                    value={val}
                    onChange={(e) => handleOtpChange(e.target.value, idx)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    className="w-12 h-14 bg-gray-950 border border-gray-800 focus:border-indigo-500 text-center text-xl font-bold font-mono text-white rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-500/15 transition-all"
                    required
                  />
                ))}
              </div>

              <button
                type="submit"
                disabled={otpLoading || otpValues.join('').length < 6}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-4 transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98]"
              >
                {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify Account'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-4">
              <p className="text-xs text-gray-500">
                Didn't receive the code?{' '}
                {otpTimer > 0 ? (
                  <span className="text-gray-400 font-semibold font-mono">Resend in {otpTimer}s</span>
                ) : (
                  <button
                    onClick={handleResendOtp}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowOtpScreen(false);
                  setIsRegistering(true);
                  setOtpValues(['', '', '', '', '', '']);
                  setOtpError('');
                }}
                className="text-gray-500 hover:text-gray-300 text-xs font-semibold transition-colors cursor-pointer block mx-auto"
              >
                Back to Registration
              </button>
            </div>
          </div>
        ) : isForgotPassword ? (
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
                Reset Password
              </h1>
              <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                Enter your email address to receive a secure password reset link
              </p>
            </div>

            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-emerald-400 text-sm">{forgotSuccess}</p>
              </div>
            )}

            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 pl-1">
                  Email Address
                </label>
                <div className="relative group">
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 hover:border-gray-700 focus:border-indigo-500 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pl-12 font-sans"
                    placeholder="email@example.com"
                    required
                  />
                  <Wallet className="w-5 h-5 text-gray-500 absolute left-4 top-3.5 group-focus-within:text-indigo-400 transition-colors" />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 transition-all duration-300 flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {forgotLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError('');
                  setForgotSuccess('');
                }}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
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



              {!isRegistering && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError('');
                      setForgotSuccess('');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-4 transition-all duration-300 flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Generate' : 'Sign In to Dashboard')}
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
        )}
      </div>
    </div>
  );
};

export default LoginPage;
