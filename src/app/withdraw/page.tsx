'use client';

import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import type { RootState } from '@/store/store';
import api from '@/api/axios';
import Layout from '@/components/Layout';
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
}

export default function WithdrawPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  // Hydration safety
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth Protection
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, router, mounted]);

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

  const [inrRate, setInrRate] = useState<number>(83.50);
  const [rateLoading, setRateLoading] = useState<boolean>(true);
  const [balanceINR, setBalanceINR] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState<boolean>(true);

  const fetchProfileAndBalance = useCallback(async () => {
    try {
      const res = await api.get('/user/profile');
      const user = res.data;
      const totalDepositsINR = (user.deposits || [])
        .filter((d: DepositItem) => ['APPROVED', 'SUCCESS'].includes(d.status))
        .reduce((acc: number, d: DepositItem) => acc + (d.equivalentINR ?? (d.amountUSD * (d.adminEnteredRate ?? 83.50))), 0);
      const totalWithdrawalsINR = (user.withdrawals || [])
        .filter((w: WithdrawalItem) => ['PENDING', 'APPROVED', 'PAID'].includes(w.status))
        .reduce((acc: number, w: WithdrawalItem) => acc + w.amountINR, 0);
      setBalanceINR(totalDepositsINR - totalWithdrawalsINR);
    } catch (err) {
      console.error('Failed to fetch profile/balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let active = true;
    const fetchRate = async () => {
      try {
        const res = await api.get('/user/rate');
        if (active && res.data && typeof res.data.rate === 'number') {
          setInrRate(res.data.rate);
        }
      } catch (err) {
        console.warn('Failed to fetch custom USD/INR rate from backend:', err);
      } finally {
        if (active) {
          setRateLoading(false);
        }
      }
    };

    fetchRate();
    fetchProfileAndBalance();

    return () => {
      active = false;
    };
  }, [fetchProfileAndBalance, isAuthenticated]);

  const handleINRChange = (val: string) => {
    setAmountINR(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setAmountUSD((num / inrRate).toFixed(2));
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
      const isErc20 = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
      if (!isTrc20 && !isErc20) {
        setError('Please enter a valid USDT Wallet Address (TRC20 starting with T, or ERC20 starting with 0x)');
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
        : `$${parseFloat(amountUSD).toFixed(2)} USDT (₹${parsedINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`;

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

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6 font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Withdraw Funds</h1>
          <p className="text-gray-400 mt-2">Choose your preferred withdrawal method below</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-gray-950 border border-gray-800 rounded-2xl p-1.5 w-full">
          <button
            onClick={() => { setMethod('BANK'); setError(''); setSuccess(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${method === 'BANK'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
              }`}
          >
            <Building2 className="w-4 h-4" />
            Bank Transfer (INR)
          </button>
          <button
            onClick={() => { setMethod('USDT'); setError(''); setSuccess(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${method === 'USDT'
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
              }`}
          >
            <Wallet className="w-4 h-4" />
            Crypto Withdrawal (USDT)
          </button>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-xl">
          {error && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {/* Balance Card */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-lg">
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Available Balance</p>
                <p className="text-sm font-bold text-white mt-0.5 font-mono">
                  {balanceLoading ? 'Loading...' : `₹${balanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR`}
                </p>
              </div>
            </div>

            {/* Live Exchange Rate Card */}
            <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-lg">
                  <RefreshCw className={`w-4 h-4 text-indigo-400 ${rateLoading ? 'animate-spin' : ''}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Exchange Rate (Live)</p>
                  <p className="text-sm font-bold text-white mt-0.5 font-mono">
                    {rateLoading ? 'Fetching...' : `1 USD = ₹${inrRate.toFixed(2)} INR`}
                  </p>
                </div>
              </div>
              <div className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-semibold border border-indigo-500/20 font-mono">
                USD / INR
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* BANK Transfer Section */}
            {method === 'BANK' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Withdrawal Amount (INR)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={amountINR}
                      onChange={(e) => handleINRChange(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="10,000.00"
                      required
                    />
                    <span className="absolute left-4 top-3 text-gray-500 font-medium font-sans">₹</span>
                  </div>
                  {amountINR && !isNaN(parseFloat(amountINR)) && (
                    <div className="mt-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Equivalent USDT/USD:</span>
                      <span className="text-emerald-400 font-bold font-mono">${(parseFloat(amountINR) / inrRate).toFixed(2)} USD</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-800 space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-400" />
                    Bank Details
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Beneficiary Name</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Account Number</label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        placeholder="1234567890"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">IFSC Code</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                          className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 uppercase"
                          placeholder="HDFC0001234"
                          required
                        />
                        <Building2 className="w-4 h-4 text-gray-500 absolute left-4 top-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* USDT Section */}
            {method === 'USDT' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Withdrawal Amount (USDT / USD)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={amountUSD}
                      onChange={(e) => handleUSDChange(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="100.00"
                      required
                    />
                    <span className="absolute left-4 top-3 text-gray-500 font-medium font-sans">$</span>
                  </div>
                  {amountUSD && !isNaN(parseFloat(amountUSD)) && (
                    <div className="mt-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-3 flex items-center justify-between text-xs">
                      <span className="text-gray-400 font-medium">Equivalent INR (deducted from balance):</span>
                      <span className="text-emerald-400 font-bold font-mono">₹{(parseFloat(amountUSD) * inrRate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-800 space-y-4">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-indigo-400" />
                    Crypto Details
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Recipient Full Name</label>
                    <input
                      type="text"
                      value={accountHolder}
                      onChange={(e) => setAccountHolder(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="John Doe"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5 font-semibold">Wallet Address</label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-mono"
                      placeholder="T..."
                      required
                    />
                    <p className="text-gray-500 text-[11px] mt-1 font-sans">Please double-check your network destination (TRC20/ERC20) before submitting.</p>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl py-3.5 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Withdrawal'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
