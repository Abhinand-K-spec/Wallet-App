'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { QrCode, Copy, CheckCircle2, Loader2, AlertCircle, ExternalLink, Coins, KeyRound, ArrowRight, RefreshCw, ArrowLeft, Check } from 'lucide-react';
import { useExchangeRate } from '@/context/ExchangeRateContext';

interface RateResponse {
  rate: number;
}

interface DepositAddressResponse {
  walletAddress: string;
}

export default function DepositPage() {
  const dispatch = useDispatch();
  const router = useRouter();

  // Form states
  const [amountUSD, setAmountUSD] = useState('');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [step, setStep] = useState(1);

  // Info states
  const [walletAddress, setWalletAddress] = useState('Loading address...');
  const { exchangeRate, rateLoading: isRateFetching } = useExchangeRate();
  const [copied, setCopied] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  // Email verification check on mount
  useEffect(() => {
    setProfileLoading(false);
  }, []);

  // Fetch Wallet Address
  useEffect(() => {
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
  }, [dispatch]);

  // Handle address copy
  const copyToClipboard = () => {
    if (walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address') {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      dispatch(addToast({ message: 'Address copied to clipboard!', type: 'success' }));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Generate deep link for Trust Wallet (TRC20 USDT)
  const isTron = walletAddress.startsWith('T');
  const qrPayload = isTron
    ? `https://link.trustwallet.com/send?asset=c195_tTR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&address=${walletAddress}`
    : `https://link.trustwallet.com/send?address=${walletAddress}`;

  const qrImageUrl = walletAddress && walletAddress !== 'Loading address...' && walletAddress !== 'Error fetching address' ? '/tron_qr.jpeg' : '';

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
    setStep(1);
  };

  // Calculate equivalent INR
  const amountNum = parseFloat(amountUSD);
  const equivalentINR = !isNaN(amountNum) ? (amountNum * exchangeRate).toFixed(2) : '0.00';

  if (profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 font-sans">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm text-gray-500">Checking verification status...</p>
      </div>
    );
  }

  return (
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
          /* Main Deposit Layout: Single column Centered Step-by-Step Card */
          <div className="max-w-xl mx-auto space-y-6">
            
            {/* Step Indicators */}
            <div className="flex items-center justify-between relative mb-8 px-4 select-none">
              {/* Connection Line */}
              <div className="absolute left-6 right-6 top-[18px] h-0.5 bg-gray-800 -z-10">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${((step - 1) / 2) * 100}%` }}
                />
              </div>

              {[
                { label: 'Amount', number: 1 },
                { label: 'Pay', number: 2 },
                { label: 'Verify', number: 3 },
              ].map((s) => (
                <div key={s.number} className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300 ${
                      step >= s.number
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                        : 'bg-gray-950 text-gray-500 border-gray-850'
                    }`}
                  >
                    {step > s.number ? <Check className="w-4 h-4" /> : s.number}
                  </div>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider mt-2 transition-colors duration-300 ${
                      step >= s.number ? 'text-indigo-400' : 'text-gray-500'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Container Card */}
            <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              {/* Glow overlay */}
              <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -left-10 -top-10 w-36 h-36 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

              {/* STEP 1: AMOUNT ENTER */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="border-b border-gray-800/60 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <Coins className="w-5 h-5 text-indigo-400" />
                      1. Deposit Amount
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the amount of USDT you plan to deposit.
                    </p>
                  </div>

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

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Amount to Deposit (USDT)
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
                        className="block w-full pl-11 pr-16 bg-gray-950 border border-gray-850 rounded-2xl py-3.5 text-white placeholder-gray-600 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 text-base transition-all duration-200"
                        placeholder="0.0000"
                        required
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <span className="text-gray-500 font-bold text-sm">USDT</span>
                      </div>
                    </div>
                    {amountUSD && !isNaN(parseFloat(amountUSD)) && (
                      <p className="text-xs text-gray-500 pl-1">
                        Estimated value: <span className="text-emerald-400 font-bold font-mono">₹{equivalentINR} INR</span>
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!amountUSD || parseFloat(amountUSD) <= 0}
                    onClick={() => setStep(2)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-3.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
                  >
                    Continue to Pay <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: SCAN & SEND (PAYMENT DETAILS) */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="border-b border-gray-800/60 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-indigo-400" />
                      2. Transfer USDT
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Send exactly <span className="font-bold text-white font-mono">{amountUSD} USDT</span> to the address below.
                    </p>
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

                  {/* QR Code Container */}
                  <div className="flex flex-col items-center py-2">
                    <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl relative shadow-xl flex items-center justify-center min-w-[180px] min-h-[180px] border border-white/20 hover:scale-[1.02] transition-all duration-300 group overflow-hidden">
                      {qrImageUrl ? (
                        <>
                          <img
                            src={qrImageUrl}
                            alt="Admin TRC20 USDT QR"
                            className="w-40 h-40 block rounded-lg select-none"
                          />
                          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        </>
                      ) : (
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                      )}
                    </div>
                  </div>

                  {/* Copyable Address field */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block pl-1">
                      Admin Wallet Address (TRC20)
                    </label>
                    <div className="w-full bg-gray-950/80 rounded-2xl p-3.5 flex items-center justify-between border border-gray-850 hover:border-indigo-500/30 transition-all duration-300 group">
                      <code className="text-xs text-indigo-400 font-mono block break-all pr-3 select-all">
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
                      className="w-full bg-gray-850 hover:bg-gray-850 text-white font-semibold rounded-2xl py-3.5 transition-all flex items-center justify-center gap-2 text-sm border border-gray-800 hover:border-gray-750 shadow-md cursor-pointer active:scale-[0.98]"
                    >
                      Pay via Trust Wallet
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </a>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 bg-gray-905 border border-gray-800 hover:border-gray-700 text-white font-semibold rounded-2xl py-3.5 px-4 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl py-3.5 px-4 shadow-lg shadow-indigo-600/15 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                    >
                      Next <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SUBMIT HASH */}
              {step === 3 && (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="border-b border-gray-800/60 pb-3">
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-indigo-400" />
                      3. Verify Transfer
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the 64-character transaction hash (TxID) of your transfer.
                    </p>
                  </div>

                  {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-400 text-xs font-semibold leading-relaxed">{errorMsg}</p>
                    </div>
                  )}

                  {/* Summary Box */}
                  <div className="bg-gray-955 border border-gray-850 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Amount Sent:</span>
                      <span className="font-bold text-white font-mono">{amountUSD} USDT (~₹{equivalentINR})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sent to Address:</span>
                      <span className="font-mono text-indigo-400 select-all max-w-[200px] truncate" title={walletAddress}>{walletAddress}</span>
                    </div>
                  </div>

                  {/* Tx Hash Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
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
                        className="block w-full pl-11 pr-4 bg-gray-955 border border-gray-855 rounded-2xl py-3.5 text-white placeholder-gray-650 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-500/80 text-sm font-mono transition-all duration-200 disabled:opacity-50"
                        placeholder="Enter TRON tx hash (TxID)"
                        required
                      />
                    </div>
                    <p className="text-[10px] text-gray-500 pl-1 leading-relaxed">
                      Standard format is 64 hex characters. Auto-verification starts immediately after submission.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setStep(2)}
                      className="flex-1 bg-gray-905 border border-gray-800 hover:border-gray-700 text-white font-semibold rounded-2xl py-3.5 px-4 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 text-sm cursor-pointer disabled:opacity-50"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !txHash}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl py-3.5 px-4 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 active:scale-[0.98] cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify & Submit
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}
      </div>
  );
}
