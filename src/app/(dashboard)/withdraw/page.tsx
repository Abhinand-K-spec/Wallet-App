'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { useExchangeRate } from '@/context/ExchangeRateContext';
import { Building2, Landmark, CheckCircle2, Loader2, AlertCircle, RefreshCw, DollarSign, Wallet } from 'lucide-react';

type MethodType = 'BANK' | 'USDT';

interface DepositItem {
  status: string;
  equivalentINR: number | null;
  amountUSD: number;
  adminEnteredRate: number | null;
}

interface WithdrawalItem {
  status: string;
  amountINR: number;
  amountUSD: number;
  method: 'BANK' | 'USDT';
}

export default function WithdrawPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [method, setMethod] = useState<MethodType>('BANK');
  const [amountUSD, setAmountUSD] = useState('');
  const [amountINR, setAmountINR] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const { exchangeRate: inrRate, rateLoading } = useExchangeRate();
  const [balanceUSD, setBalanceUSD] = useState<number>(0);
  const [balanceINR, setBalanceINR] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(true);

  const isExceeded = method === 'BANK'
    ? (amountINR && !isNaN(parseFloat(amountINR)) && parseFloat(amountINR) > balanceINR)
    : (amountUSD && !isNaN(parseFloat(amountUSD)) && parseFloat(amountUSD) + 0.5 > balanceUSD);

  const fetchProfileAndBalance = useCallback(async () => {
    try {
      const res = await api.get('/user/profile');
      const user = res.data;



      const totalDepositsUSD = (user.deposits || [])
        .filter((d: DepositItem) => ['APPROVED', 'SUCCESS'].includes(d.status))
        .reduce((acc: number, d: DepositItem) => acc + d.amountUSD, 0);
      const totalWithdrawalsUSD = (user.withdrawals || [])
        .filter((w: WithdrawalItem) => ['PENDING', 'APPROVED', 'PAID'].includes(w.status))
        .reduce((acc: number, w: WithdrawalItem) => {
          const fee = w.method === 'USDT' ? 0.5 : 0;
          return acc + w.amountUSD + fee;
        }, 0);
      setBalanceUSD(Math.max(0, totalDepositsUSD - totalWithdrawalsUSD));

      const totalDepositsINR = (user.deposits || [])
        .filter((d: DepositItem) => ['APPROVED', 'SUCCESS'].includes(d.status))
        .reduce((acc: number, d: DepositItem) => acc + (d.equivalentINR || 0), 0);
      const totalWithdrawalsINR = (user.withdrawals || [])
        .filter((w: WithdrawalItem) => ['PENDING', 'APPROVED', 'PAID'].includes(w.status))
        .reduce((acc: number, w: WithdrawalItem) => {
          const rateAtWithdrawal = w.amountUSD > 0 ? (w.amountINR / w.amountUSD) : inrRate;
          const feeINR = w.method === 'USDT' ? 0.5 * rateAtWithdrawal : 0;
          return acc + w.amountINR + feeINR;
        }, 0);
      setBalanceINR(Math.max(0, totalDepositsINR - totalWithdrawalsINR));
    } catch (err) {
      console.error('Failed to fetch profile/balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, [dispatch, router, inrRate]);

  useEffect(() => {
    fetchProfileAndBalance();
  }, [fetchProfileAndBalance]);

  const handleINRChange = (val: string) => {
    setAmountINR(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAmountUSD((num / inrRate).toFixed(4));
    } else {
      setAmountUSD('');
    }
  };

  const handleUSDChange = (val: string) => {
    setAmountUSD(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAmountINR((num * inrRate).toFixed(2));
    } else {
      setAmountINR('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const parsedINR = parseFloat(amountINR);
    const parsedUSD = parseFloat(amountUSD);

    if (method === 'BANK') {
      if (isNaN(parsedINR) || parsedINR <= 0) {
        setError('Amount must be greater than 0');
        setLoading(false);
        return;
      }
      if (parsedINR > balanceINR) {
        setError(`Insufficient balance. Maximum available: ₹${balanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`);
        setLoading(false);
        return;
      }
    } else {
      if (isNaN(parsedUSD) || parsedUSD <= 0) {
        setError('Amount must be greater than 0');
        setLoading(false);
        return;
      }
      if (parsedUSD + 0.5 > balanceUSD) {
        setError(`Insufficient balance. Maximum available: $${Math.max(0, balanceUSD - 0.5).toFixed(4)} USDT (with 0.5 USDT fee)`);
        setLoading(false);
        return;
      }
    }

    // Input fields validation
    if (!/^[a-zA-Z\s.]{3,60}$/.test(accountHolder.trim())) {
      setError(method === 'BANK'
        ? 'Please enter a valid Account Holder Name (minimum 3 characters, letters and spaces only)'
        : 'Please enter a valid Recipient Full Name (minimum 3 characters, letters and spaces only)'
      );
      setLoading(false);
      return;
    }

    if (method === 'BANK') {
      if (!/^\d{9,18}$/.test(accountNumber)) {
        setError('Please enter a valid bank account number (9 to 18 digits only)');
        setLoading(false);
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        setError('Please enter a valid 11-digit IFSC code (e.g., HDFC0001234)');
        setLoading(false);
        return;
      }
    } else {
      const isTrc20 = /^T[a-zA-Z0-9]{33}$/.test(walletAddress);
      if (!isTrc20) {
        setError('Please enter a valid USDT Wallet Address (TRC20 starting with T)');
        setLoading(false);
        return;
      }
    }

    try {
      const payload: {
        method: MethodType;
        accountHolder: string;
        amountINR?: string;
        accountNumber?: string;
        ifsc?: string;
        amountUSD?: string;
        walletAddress?: string;
      } = {
        method,
        accountHolder,
      };

      if (method === 'BANK') {
        payload.amountINR = amountINR;
        payload.accountNumber = accountNumber;
        payload.ifsc = ifsc;
      } else {
        payload.amountUSD = amountUSD;
        payload.walletAddress = walletAddress;
      }

      await api.post('/user/withdraw', payload);

      const formattedAmount = method === 'BANK'
        ? `₹${parsedINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
        : `$${parseFloat(amountUSD).toFixed(4)} USDT (₹${parsedINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`;

      const msg = `Withdrawal request for ${formattedAmount} submitted successfully! Pending admin approval.`;
      setSuccess(msg);
      dispatch(addToast({ message: msg, type: 'success' }));

      // Reset fields
      setAmountUSD('');
      setAmountINR('');
      setAccountHolder('');
      setAccountNumber('');
      setIfsc('');
      setWalletAddress('');

      // Refresh balance
      fetchProfileAndBalance();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to submit withdrawal request';
      setError(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setLoading(false);
    }
  };

  if (balanceLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-500">Checking verification status...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 font-sans px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 bg-clip-text text-transparent">
          Withdraw Funds
        </h1>
        <p className="text-gray-400 mt-2 text-sm">Choose your preferred withdrawal method below</p>
        <p className="text-red-400 mt-2 text-sm">The amount will be deducted from your total deposits</p>
        <p className="text-greem-400 mt-2 text-sm">Withdrawal requests are processed within 24-48 hours</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-950/80 border border-gray-850 rounded-2xl p-1.5 w-full">
        <button
          onClick={() => { setMethod('BANK'); setError(''); setSuccess(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer ${method === 'BANK'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
            : 'text-gray-400 hover:text-white hover:bg-gray-900/40'
            }`}
        >
          <Building2 className="w-4 h-4" />
          Bank Transfer (INR)
        </button>
        <button
          onClick={() => { setMethod('USDT'); setError(''); setSuccess(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer ${method === 'USDT'
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
            : 'text-gray-400 hover:text-white hover:bg-gray-900/40'
            }`}
        >
          <Wallet className="w-4 h-4" />
          Crypto Withdrawal (USDT)
        </button>
      </div>

      <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs font-semibold leading-relaxed">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
            <p className="text-green-400 text-xs font-semibold leading-relaxed">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {/* Balance Card */}
          <div className="bg-gray-950/80 border border-gray-850 rounded-2xl p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400 shrink-0">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Available Balance</p>
              <p className="text-sm font-bold text-white mt-0.5 font-mono">
                {balanceLoading ? 'Loading...' : `₹${balanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
              </p>
            </div>
          </div>

          {/* Live Exchange Rate Card */}
          <div className="bg-gray-950/80 border border-gray-855 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                <RefreshCw className={`w-4 h-4 text-indigo-400 ${rateLoading ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Exchange Rate (Live)</p>
                <p className="text-sm font-bold text-white mt-0.5 font-mono">
                  {rateLoading ? 'Fetching...' : `1 USDT = ₹${inrRate.toFixed(2)} INR`}
                </p>
              </div>
            </div>
            <div className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-500/20 font-sans shrink-0 self-start">
              USDT / INR
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* BANK Transfer Section */}
          {method === 'BANK' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Withdrawal Amount (INR)</label>
                <div className="relative rounded-2xl shadow-sm">
                  <input
                    type="number"
                    step="0.01"
                    value={amountINR}
                    onChange={(e) => handleINRChange(e.target.value)}
                    className={`w-full bg-gray-950 border text-white rounded-2xl px-4 py-3.5 pl-11 focus:outline-none focus:ring-4 ${
                      amountINR && !isNaN(parseFloat(amountINR)) && parseFloat(amountINR) > balanceINR
                        ? 'border-red-500/80 focus:ring-red-500/15 focus:border-red-500/80'
                        : 'border-gray-850 focus:ring-indigo-500/15 focus:border-indigo-500/80'
                    }`}
                    placeholder="10,000.00"
                    required
                  />
                  <span className="absolute left-4 top-3.5 text-gray-500 font-bold font-sans">₹</span>
                </div>
                {amountINR && !isNaN(parseFloat(amountINR)) && parseFloat(amountINR) > balanceINR && (
                  <p className="text-red-400 text-xs mt-1.5 font-semibold">Amount exceeds your available balance.</p>
                )}
              </div>

              <div className="pt-5 border-t border-gray-850 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider text-gray-400">
                  <Landmark className="w-4 h-4 text-indigo-400" />
                  Bank Details
                </h3>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Beneficiary Name</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-855 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80"
                      placeholder="1234567890"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">IFSC Code</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={ifsc}
                        onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                        className="w-full bg-gray-950 border border-gray-855 text-white rounded-2xl px-4 py-3 pl-11 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 uppercase"
                        placeholder="HDFC0001234"
                        required
                      />
                      <Building2 className="w-4 h-4 text-gray-500 absolute left-4 top-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* USDT Section */}
          {method === 'USDT' && (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Withdrawal Amount (USDT)</label>
                <div className="relative rounded-2xl shadow-sm">
                  <input
                    type="number"
                    step="0.0001"
                    value={amountUSD}
                    onChange={(e) => handleUSDChange(e.target.value)}
                    className={`w-full bg-gray-950 border text-white rounded-2xl px-4 py-3.5 pl-11 focus:outline-none focus:ring-4 ${
                      amountUSD && !isNaN(parseFloat(amountUSD)) && parseFloat(amountUSD) + 0.5 > balanceUSD
                        ? 'border-red-500/80 focus:ring-red-500/15 focus:border-red-500/80'
                        : 'border-gray-855 focus:ring-indigo-500/15 focus:border-indigo-500/80'
                    }`}
                    placeholder="100.0000"
                    required
                  />
                  <span className="absolute left-4 top-3.5 text-gray-500 font-bold font-sans">$</span>
                </div>
                {amountUSD && !isNaN(parseFloat(amountUSD)) && parseFloat(amountUSD) + 0.5 > balanceUSD && (
                  <p className="text-red-400 text-xs mt-1.5 font-semibold">Amount + 0.5 USDT fee exceeds your available balance.</p>
                )}
                {amountUSD && !isNaN(parseFloat(amountUSD)) && (
                  <div className="mt-2 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-3 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Platform Fee:</span>
                      <span className="text-amber-400 font-bold font-mono">0.5000 USDT</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 font-medium">Total Deducted:</span>
                      <span className="text-red-400 font-bold font-mono">${(parseFloat(amountUSD) + 0.5).toFixed(4)} USDT</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-emerald-500/10 pt-1 mt-1">
                      <span className="text-gray-400 font-medium">Equivalent INR (deducted from balance):</span>
                      <span className="text-emerald-400 font-bold font-mono">₹{((parseFloat(amountUSD) + 0.5) * inrRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-5 border-t border-gray-850 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider text-gray-400">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  Crypto Details
                </h3>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Recipient Full Name</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-855 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80"
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">Wallet Address</label>
                  <input
                    type="text"
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-850 text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 font-mono text-sm"
                    placeholder="T..."
                    required
                    pattern="^T[a-zA-Z0-9]{33}$"
                  />
                  <p className="text-gray-500 text-[10px] mt-1.5 leading-relaxed font-sans">Please double-check your network destination (TRC20 only) before submitting.</p>
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || !!isExceeded}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-3.5 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 text-base"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
          </button>
        </form>
      </div>
    </div>
  );
}
