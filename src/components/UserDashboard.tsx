'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { ArrowDownToLine, ArrowUpFromLine, Activity, Wallet, Plus, ArrowUpRight, History, AlertTriangle, Loader2, X, ShieldCheck } from 'lucide-react';
import { useExchangeRate } from '@/context/ExchangeRateContext';

interface Deposit {
  id: string;
  status: string;
  amountUSD: number;
  equivalentINR: number | null;
  adminEnteredRate: number | null;
}

interface Withdrawal {
  id: string;
  status: string;
  amountUSD: number;
  amountINR: number;
  method: 'BANK' | 'USDT';
}

interface Transaction {
  id: string;
  transactionType: string;
  amountUSD: number;
  amountINR: number | null;
  status: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  userId: string;
  email: string;
  email_verified?: boolean;
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  transactions: Transaction[];
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-700/20'}`;
};

const UserDashboard = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const dispatch = useDispatch();
  const { exchangeRate: inrRate } = useExchangeRate();

  // Custom OTP Verification States
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpTimer, setOtpTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');

  // Countdown timer for OTP
  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleSendOtp = async () => {
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);
    try {
      const res = await api.post('/auth/custom-send-otp');
      setOtpTimer(30);
      setShowOtpModal(true);
      if (res.data.code) {
        setOtpSuccess(`[Dev Mode] Verification code generated: ${res.data.code}`);
      } else {
        setOtpSuccess('Verification code sent to your email.');
      }
      dispatch(addToast({ message: 'Verification code sent!', type: 'success' }));
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to send verification code';
      setOtpError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError('');
    setOtpSuccess('');
    setOtpLoading(true);

    const code = otpValues.join('');
    if (code.length < 6) {
      setOtpError('Please enter the 6-digit code.');
      setOtpLoading(false);
      return;
    }

    try {
      await api.post('/auth/custom-verify-otp', { code });
      dispatch(addToast({ message: 'Email verified successfully!', type: 'success' }));
      setShowOtpModal(false);
      setOtpValues(['', '', '', '', '', '']);
      
      // Refresh profile data
      const res = await api.get('/user/profile');
      setProfile(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Verification failed';
      setOtpError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    if (value && isNaN(Number(value))) return;
    const newOtpValues = [...otpValues];
    newOtpValues[index] = value.substring(value.length - 1);
    setOtpValues(newOtpValues);

    if (value && index < 5) {
      const nextInput = document.getElementById(`dash-otp-${index + 1}`) as HTMLInputElement;
      nextInput?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      const prevInput = document.getElementById(`dash-otp-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        setProfile(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 font-sans">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
        <p className="text-sm text-gray-500">Loading your profile dashboard...</p>
      </div>
    );
  }

  const totalDepositsUSD = profile?.deposits?.filter((d: Deposit) => ['APPROVED', 'SUCCESS'].includes(d.status)).reduce((acc: number, d: Deposit) => acc + d.amountUSD, 0) || 0;
  
  // For Available Balance: deduct pending withdrawals as well to prevent overdraft
  const totalWithdrawalsUSD_Available = profile?.withdrawals?.filter((w: Withdrawal) => ['PENDING', 'APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => {
    const fee = w.method === 'USDT' ? 0.5 : 0;
    return acc + w.amountUSD + fee;
  }, 0) || 0;
  const availableBalanceUSD = Math.max(0, totalDepositsUSD - totalWithdrawalsUSD_Available);

  const totalDepositsINR = profile?.deposits?.filter((d: Deposit) => ['APPROVED', 'SUCCESS'].includes(d.status)).reduce((acc: number, d: Deposit) => acc + (d.equivalentINR || 0), 0) || 0;
  const totalWithdrawalsINR = profile?.withdrawals?.filter((w: Withdrawal) => ['APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => {
    const rateAtWithdrawal = w.amountUSD > 0 ? (w.amountINR / w.amountUSD) : inrRate;
    const feeINR = w.method === 'USDT' ? 0.5 * rateAtWithdrawal : 0;
    return acc + w.amountINR + feeINR;
  }, 0) || 0;

  const totalWithdrawalsINR_Available = profile?.withdrawals?.filter((w: Withdrawal) => ['PENDING', 'APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => {
    const rateAtWithdrawal = w.amountUSD > 0 ? (w.amountINR / w.amountUSD) : inrRate;
    const feeINR = w.method === 'USDT' ? 0.5 * rateAtWithdrawal : 0;
    return acc + w.amountINR + feeINR;
  }, 0) || 0;
  const availableBalanceINR = Math.max(0, totalDepositsINR - totalWithdrawalsINR_Available);

  // Total withdrawals displayed in ledger metrics cards (only APPROVED and PAID)
  const totalWithdrawalsUSD = profile?.withdrawals?.filter((w: Withdrawal) => ['APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => {
    const fee = w.method === 'USDT' ? 0.5 : 0;
    return acc + w.amountUSD + fee;
  }, 0) || 0;

  return (
    <div className="space-y-8 font-sans">
      {/* Email Verification Banner */}
      {!profile?.email_verified && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-white">Email Verification Required</h4>
              <p className="text-xs text-gray-400 mt-1">Please verify your email address to enable deposits and withdrawals on your secure wallet.</p>
            </div>
          </div>
          <button
            onClick={handleSendOtp}
            disabled={otpLoading}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-gray-950 text-xs font-bold rounded-xl transition-all active:scale-[0.98] shrink-0 cursor-pointer flex items-center gap-1.5 shadow-md shadow-amber-500/10"
          >
            {otpLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Verify Email
          </button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-white tracking-tight">Overview</h1>
        <p className="text-gray-400 text-sm mt-1">Real-time status of your assets and deposits</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Area: Virtual Card & Actions Grid (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Virtual Credit Card Widget */}
          <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl min-h-[220px] flex flex-col justify-between hover:scale-[1.01] transition-transform duration-300 group border border-indigo-400/20">
            {/* Gloss reflection overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/10 opacity-60 pointer-events-none" />
            
            {/* Tech glowing design circles */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-10 -top-10 w-44 h-44 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="w-11 h-8 bg-amber-400/30 border border-amber-400/40 rounded-md relative overflow-hidden flex flex-wrap gap-0.5 p-1 shrink-0">
                <div className="w-full h-[1px] bg-amber-400/30"></div>
                <div className="w-1/2 h-full bg-amber-400/20"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="bg-white/10 w-6 h-6 rounded-md flex items-center justify-center backdrop-blur-md">
                  <Wallet className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-white">GetPay Wallet Card</span>
              </div>
            </div>

            <div className="relative z-10 my-4">
              <p className="text-[10px] text-indigo-200 uppercase font-bold tracking-widest pl-0.5">Available Balance</p>
              <h3 className="text-3xl font-black text-white mt-1">₹{availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-indigo-200/80 font-mono mt-0.5 pl-0.5">${availableBalanceUSD.toFixed(4)} USDT</p>
            </div>

            <div className="flex items-center justify-between relative z-10 pt-3 border-t border-indigo-400/20 text-xs">
              <div>
                <p className="text-[9px] text-indigo-300 uppercase tracking-wider">Account ID</p>
                <p className="font-semibold text-white truncate max-w-[150px]">{profile?.email}</p>
              </div>
              <div>
                <p className="text-[9px] text-indigo-300 uppercase tracking-wider text-right">User code</p>
                <p className="font-mono text-white text-right">{profile?.userId}</p>
              </div>
            </div>
          </div>

          {/* Quick Action Grid */}
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => {
                if (!profile?.email_verified) {
                  dispatch(addToast({ message: 'Please verify your email address to access deposits.', type: 'info' }));
                  handleSendOtp();
                } else {
                  router.push('/deposit');
                }
              }}
              className={`w-full bg-gray-900 border border-gray-800 hover:border-indigo-500/30 rounded-2xl p-4 text-center hover:scale-[1.02] transition-all duration-300 group cursor-pointer animate-fade-in ${
                !profile?.email_verified ? 'opacity-60' : ''
              }`}
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-2 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-200">Deposit</p>
            </button>

            <button
              onClick={() => {
                if (!profile?.email_verified) {
                  dispatch(addToast({ message: 'Please verify your email address to access withdrawals.', type: 'info' }));
                  handleSendOtp();
                } else {
                  router.push('/withdraw');
                }
              }}
              className={`w-full bg-gray-900 border border-gray-800 hover:border-indigo-500/30 rounded-2xl p-4 text-center hover:scale-[1.02] transition-all duration-300 group cursor-pointer animate-fade-in ${
                !profile?.email_verified ? 'opacity-60' : ''
              }`}
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-2 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                <ArrowUpRight className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-200">Withdraw</p>
            </button>

            <button
              onClick={() => router.push('/history')}
              className="w-full bg-gray-900 border border-gray-800 hover:border-indigo-500/30 rounded-2xl p-4 text-center hover:scale-[1.02] transition-all duration-300 group cursor-pointer animate-fade-in"
            >
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center mx-auto mb-2 text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
                <History className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-gray-200">Ledger</p>
            </button>
          </div>
        </div>

        {/* Right Area: Transaction Ledger & Metrics Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Total Deposits Card */}
          <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4 hover:border-gray-700 transition-colors">
            <div className="p-3 bg-red-500/10 rounded-xl text-red-400 shrink-0">
              <ArrowDownToLine className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Deposits</p>
              <h3 className="text-xl font-bold text-white mt-0.5">₹{totalDepositsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">${totalDepositsUSD.toFixed(4)} USDT</p>
            </div>
          </div>

          {/* Total Withdrawals Card */}
          <div className="bg-gray-900 border border-gray-800/80 rounded-2xl p-5 shadow-lg flex items-center gap-4 hover:border-gray-700 transition-colors">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
              <ArrowUpFromLine className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Withdrawals</p>
              <h3 className="text-xl font-bold text-white mt-0.5">₹{totalWithdrawalsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5">${totalWithdrawalsUSD.toFixed(4)} USDT</p>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Area: Recent Activity Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Recent Transactions</h2>
          <button onClick={() => router.push('/history')} className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer">
            View All Ledger
          </button>
        </div>
        
        <div className="bg-gray-900 border border-gray-800/80 rounded-3xl overflow-hidden shadow-xl">
          {profile && profile.transactions && profile.transactions.length > 0 ? (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/40 text-gray-400 text-xs font-semibold uppercase tracking-wider border-b border-gray-800/50">
                    <tr>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Amount (USDT)</th>
                      <th className="px-6 py-4">Amount (INR)</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {profile.transactions.slice(0, 5).map((tx: Transaction) => (
                      <tr key={tx.id} className="hover:bg-gray-800/10 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                            tx.transactionType === 'DEPOSIT' 
                              ? 'bg-red-500/10 text-red-400 border-red-500/10' 
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                          }`}>
                            {tx.transactionType === 'DEPOSIT' ? <ArrowDownToLine className="w-3.5 h-3.5" /> : <ArrowUpFromLine className="w-3.5 h-3.5" />}
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-200 font-mono">${tx.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-300 font-bold font-mono">
                          {tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={statusBadge(tx.status)}>
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-850">
                {profile.transactions.slice(0, 5).map((tx: Transaction) => (
                  <div key={tx.id} className="p-4 space-y-3 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-semibold border ${
                        tx.transactionType === 'DEPOSIT' 
                          ? 'bg-red-500/10 text-red-400 border-red-500/10' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'
                      }`}>
                        {tx.transactionType === 'DEPOSIT' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                        {tx.transactionType}
                      </span>
                      <span className={statusBadge(tx.status)}>
                        {tx.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-500">USDT Amount</p>
                        <p className="font-bold text-white font-mono">${tx.amountUSD.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">INR Value</p>
                        <p className="font-bold text-gray-300 font-mono">
                          {tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t border-gray-800/30">
                      <span>Transaction Date</span>
                      <span>
                        {new Date(tx.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center">
              <Activity className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-sm font-semibold">No recent transactions found</p>
              <p className="text-xs text-gray-600 mt-1">Submit a deposit or withdrawal to populate your ledger feed.</p>
            </div>
          )}
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/75 animate-fade-in" onClick={() => setShowOtpModal(false)} />

          {/* Modal Container */}
          <div className="relative w-full max-w-md bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl z-50 animate-fade-in-up">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-white bg-gray-800/50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white tracking-tight">Verify Your Email</h3>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed font-sans">
                Enter the 6-digit confirmation code generated for <br />
                <span className="text-indigo-400 font-semibold font-mono">{profile?.email}</span>
              </p>
            </div>

            {otpError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-400 text-xs font-semibold leading-relaxed">{otpError}</p>
              </div>
            )}

            {otpSuccess && (
              <div className="mb-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 flex items-start gap-2">
                <ShieldCheck className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-indigo-400 text-xs font-semibold leading-relaxed break-all font-mono">{otpSuccess}</p>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
              <div className="flex justify-between gap-2">
                {otpValues.map((val, idx) => (
                  <input
                    key={idx}
                    id={`dash-otp-${idx}`}
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
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-3.5 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98]"
              >
                {otpLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Verification'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-xs text-gray-500">
                Didn't receive the code?{' '}
                {otpTimer > 0 ? (
                  <span className="text-gray-400 font-semibold font-mono">Resend in {otpTimer}s</span>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors cursor-pointer"
                  >
                    Resend Code
                  </button>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
