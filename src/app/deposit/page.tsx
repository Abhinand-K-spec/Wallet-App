'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import type { RootState } from '@/store/store';
import api from '@/api/axios';
import Layout from '@/components/Layout';
import { QrCode, Copy, CheckCircle2, Loader2, AlertCircle, ExternalLink, Coins, KeyRound, ArrowRight, RefreshCw } from 'lucide-react';

interface RateResponse {
  rate: number;
}

interface DepositAddressResponse {
  walletAddress: string;
}

export default function DepositPage() {
  const dispatch = useDispatch();
  const router = useRouter();
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

  // Form states
  const [amountUSD, setAmountUSD] = useState('');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Info states
  const [walletAddress, setWalletAddress] = useState('Loading address...');
  const [exchangeRate, setExchangeRate] = useState<number>(83.50);
  const [isRateFetching, setIsRateFetching] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch Wallet Address
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchAddress = async () => {
      try {
        const res = await api.get<DepositAddressResponse>('/user/deposit-address');
        setWalletAddress(res.data.walletAddress);
      } catch (err) {
        console.error('Failed to fetch wallet address:', err);
        setWalletAddress('Error fetching address');
        dispatch(addToast({ message: 'Failed to fetch admin wallet address.', type: 'error' }));
      }
    };
    fetchAddress();
  }, [dispatch, isAuthenticated]);

  // Fetch Exchange Rate via simple polling
  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchRate = async () => {
      setIsRateFetching(true);
      try {
        const res = await api.get<RateResponse>('/user/rate');
        setExchangeRate(res.data.rate);
      } catch (err) {
        console.error('Failed to fetch rate:', err);
      } finally {
        setIsRateFetching(false);
      }
    };

    fetchRate();
    const timer = setInterval(fetchRate, 60000);
    return () => clearInterval(timer);
  }, [isAuthenticated]);

  // Handle address copy
  const copyToClipboard = () => {
    if (walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address') {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      dispatch(addToast({ message: 'Address copied to clipboard!', type: 'success' }));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Access QR from public folder (tron_qr.jpeg)
  const qrImageUrl = walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address'
    ? '/tron_qr.jpeg'
    : '';

  // Generate deep link for Trust Wallet (TRC20 USDT)
  const isTron = walletAddress.startsWith('T');
  const qrPayload = isTron
    ? `https://link.trustwallet.com/send?asset=c195_tTR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&address=${walletAddress}`
    : `https://link.trustwallet.com/send?address=${walletAddress}`;

  // Form submission handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!amountUSD || parseFloat(amountUSD) <= 0) {
      dispatch(addToast({ message: 'Please enter a valid amount greater than 0.', type: 'error' }));
      return;
    }
    if (!txHash.trim()) {
      dispatch(addToast({ message: 'Please enter the transaction hash.', type: 'error' }));
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await api.post('/user/deposit', {
        txHash: txHash.trim(),
        amountUSD: parseFloat(amountUSD),
      });

      const msg = 'Deposit submitted successfully! Pending admin verification.';
      setSuccessMsg(msg);
      dispatch(addToast({ message: msg, type: 'success' }));
      
      // Clear inputs
      setAmountUSD('');
      setTxHash('');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to submit deposit.';
      setErrorMsg(msg);
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessMsg('');
    setErrorMsg('');
  };

  // Calculate equivalent INR
  const amountNum = parseFloat(amountUSD);
  const equivalentINR = !isNaN(amountNum) ? (amountNum * exchangeRate).toFixed(2) : '0.00';

  if (!mounted || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 px-4 py-6 font-sans">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500 bg-clip-text text-transparent">
            Deposit Funds
          </h1>
          <p className="text-gray-400 mt-2 text-sm max-w-xl mx-auto">
            Send USDT (TRC20) to the admin wallet address, then submit the details below for on-chain verification.
          </p>
        </div>

        {successMsg ? (
          /* Success Screen */
          <div className="bg-gray-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-3xl p-8 text-center space-y-6 max-w-xl mx-auto shadow-2xl relative overflow-hidden">
            {/* Ambient emerald background glow */}
            <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="inline-flex p-4 bg-emerald-500/10 rounded-full animate-bounce">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Deposit Submitted!</h3>
              <p className="text-sm text-gray-400 mt-2">
                Your transaction details have been sent to our servers for verification.
              </p>
              <p className="text-xs text-emerald-400 mt-3 bg-emerald-500/5 px-4 py-2.5 rounded-xl border border-emerald-500/10 font-mono inline-block font-semibold">
                Status: PENDING ADMIN APPROVAL
              </p>
            </div>
            <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-[0.98] cursor-pointer"
              >
                Submit Another Deposit
              </button>
              <button
                onClick={() => router.push('/history')}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-all border border-gray-700 hover:border-gray-600 flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer"
              >
                View History <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Main Deposit Layout */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: QR and Address Info (5 cols on lg) */}
            <div className="lg:col-span-5 bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Subtle indigo background glow */}
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-gray-800/60 pb-3">
                <QrCode className="w-5 h-5 text-indigo-400" />
                1. Scan & Send
              </h2>

              {/* QR Code Container */}
              <div className="flex flex-col items-center py-2">
                <div className="bg-white/95 backdrop-blur-md p-5 rounded-3xl relative shadow-2xl flex items-center justify-center min-w-[220px] min-h-[220px] border border-white/20 hover:scale-[1.02] hover:shadow-indigo-500/10 transition-all duration-300 group overflow-hidden">
                  {qrImageUrl ? (
                    <>
                      <img
                        src={qrImageUrl}
                        alt="Admin TRC20 USDT QR"
                        className="w-44 h-44 block rounded-lg select-none"
                      />
                      <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    </>
                  ) : (
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                  )}
                </div>
              </div>

              {/* Network Info Badge */}
              <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400 shrink-0 font-black text-xs">
                  USDT
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-indigo-400 font-bold block">TRC20 (Tron Network)</span>
                  <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">Do not send any other token or network!</span>
                </div>
              </div>

              {/* Copyable Address field */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
                  Admin USDT Wallet Address
                </label>
                <div className="w-full bg-gray-950/80 rounded-2xl p-3.5 flex items-center justify-between border border-gray-850 hover:border-indigo-500/30 transition-all duration-300 group">
                  <code className="text-xs text-indigo-400 font-mono block truncate pr-3 select-all">
                    {walletAddress}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    disabled={walletAddress === 'Loading address...' || walletAddress === 'Error fetching address'}
                    className="p-2 bg-gray-900 hover:bg-gray-800 rounded-xl text-gray-400 hover:text-white transition-all shrink-0 disabled:opacity-50 cursor-pointer active:scale-[0.93]"
                    title="Copy wallet address"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Trust Wallet Button */}
              {walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address' && (
                <a
                  href={qrPayload}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-2xl py-3.5 transition-all flex items-center justify-center gap-2 text-sm border border-gray-700 hover:border-gray-600 shadow-md cursor-pointer active:scale-[0.98]"
                >
                  Pay via Trust Wallet
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              )}
            </div>

            {/* Right Column: Form Submission (7 cols on lg) */}
            <div className="lg:col-span-7 bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
              {/* Subtle purple background glow */}
              <div className="absolute -left-10 -top-10 w-36 h-36 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="border-b border-gray-800/60 pb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-indigo-400" />
                  2. Submit Receipt Details
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Enter your transaction amount and hash. The system will auto-verify it on-chain.
                </p>
              </div>

              {errorMsg && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-xs font-semibold leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* Live Exchange Rate info */}
              <div className="bg-gray-950/80 border border-gray-850 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl">
                    <RefreshCw className={`w-4 h-4 text-indigo-400 ${isRateFetching ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Current Exchange Rate</p>
                    <p className="text-sm font-bold text-white mt-0.5">
                      1 USDT = ₹{exchangeRate.toFixed(2)} INR
                    </p>
                  </div>
                </div>
                <div className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-black border border-indigo-500/20">
                  AUTO-REFRESH
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Amount Sent (USDT)
                  </label>
                  <div className="relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Coins className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      type="number"
                      step="0.000001"
                      min="0.000001"
                      value={amountUSD}
                      onChange={(e) => setAmountUSD(e.target.value)}
                      disabled={submitting}
                      className="block w-full pl-11 pr-16 bg-gray-950 border border-gray-850 rounded-2xl py-3.5 text-white placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 text-base transition-all duration-200 disabled:opacity-50"
                      placeholder="0.00"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-bold text-sm">USDT</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 pl-1">
                    Estimated value: <span className="text-gray-300 font-semibold">₹{equivalentINR} INR</span>
                  </p>
                </div>

                {/* Tx Hash Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Transaction Hash (TxID)
                  </label>
                  <div className="relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <KeyRound className="h-5 w-5 text-gray-500" />
                    </div>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      disabled={submitting}
                      className="block w-full pl-11 pr-4 bg-gray-950 border border-gray-855 rounded-2xl py-3.5 text-white placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 text-sm font-mono transition-all duration-200 disabled:opacity-50"
                      placeholder="Enter 64-character TRON transaction hash"
                      required
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 pl-1 leading-relaxed">
                    Provide the transaction ID of your transfer. Standard format is 64 hex characters.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || !amountUSD || !txHash}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-3.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] mt-2 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting & Verifying...
                    </>
                  ) : (
                    <>
                      Submit Deposit Receipt
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </Layout>
  );
}
