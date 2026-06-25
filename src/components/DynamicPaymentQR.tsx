'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Copy, CheckCircle2, Clock, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';

interface DynamicPaymentQRProps {
  state: 'idle' | 'creating' | 'generated' | 'expired' | 'paid' | 'failed';
  walletAddress?: string;
  amount?: string;
  qrPayload?: string;
  expiresAt?: string;
  onReset: () => void;
}

export const DynamicPaymentQR: React.FC<DynamicPaymentQRProps> = ({
  state,
  walletAddress = '',
  amount = '',
  qrPayload = '',
  expiresAt = '',
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('15:00');
  const dispatch = useDispatch();

  // Expiry Countdown Timer
  useEffect(() => {
    if (state !== 'generated' || !expiresAt) return;

    const timer = setInterval(() => {
      const difference = new Date(expiresAt).getTime() - Date.now();

      if (difference <= 0) {
        clearInterval(timer);
        setTimeLeft('00:00');
        onReset(); // Trigger reset/expiry
        return;
      }

      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      const formattedMinutes = String(minutes).padStart(2, '0');
      const formattedSeconds = String(seconds).padStart(2, '0');

      setTimeLeft(`${formattedMinutes}:${formattedSeconds}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [state, expiresAt, onReset]);

  const copyToClipboard = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      dispatch(addToast({ message: 'Address copied to clipboard!', type: 'success' }));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const qrImageUrl = walletAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(walletAddress)}`
    : '';

  // Render based on state
  if (state === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 rounded-2xl min-h-[350px] text-center font-sans">
        <QrCode className="w-16 h-16 text-indigo-500/40 mb-4 animate-pulse" />
        <h3 className="text-lg font-semibold text-white mb-2">Dynamic TRC20 Payment</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Enter an amount above and generate your order to obtain a dynamic Trust Wallet payment request.
        </p>
      </div>
    );
  }

  if (state === 'creating') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-gray-800 rounded-2xl min-h-[350px] text-center space-y-4 font-sans">
        <div className="relative flex items-center justify-center">
          <div className="w-24 h-24 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
          <QrCode className="w-10 h-10 text-indigo-500 absolute" />
        </div>
        <h3 className="text-lg font-semibold text-white">Creating Payment Order</h3>
        <p className="text-xs text-gray-500">Generating unique payment payload and secure wallet coordinates...</p>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-red-900/30 rounded-2xl min-h-[350px] text-center space-y-4 font-sans">
        <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
        <h3 className="text-lg font-semibold text-white">Payment Request Expired</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Payments must be completed within 15 minutes. This payment window has closed.
        </p>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all cursor-pointer"
        >
          Create New Request
        </button>
      </div>
    );
  }

  if (state === 'paid') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-emerald-900/30 rounded-2xl min-h-[350px] text-center space-y-4 font-sans">
        <div className="p-4 bg-emerald-500/15 rounded-full mb-2 animate-bounce">
          <CheckCircle2 className="w-16 h-16 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white">Payment Received!</h3>
        <p className="text-sm text-emerald-400 font-medium">On-chain transaction verified successfully.</p>
        <p className="text-xs text-gray-500 max-w-sm">
          USDT amount has been credited to your available balance. You can verify this in your dashboard.
        </p>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl text-sm transition-all mt-2 cursor-pointer"
        >
          Make Another Deposit
        </button>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-900 border border-red-900/30 rounded-2xl min-h-[350px] text-center space-y-4 font-sans">
        <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
        <h3 className="text-lg font-semibold text-white">Verification Failed</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          We encountered an error verifying the transaction on the TRON network.
        </p>
        <button
          onClick={onReset}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm transition-all cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6 font-sans">
      {/* Expiry Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div className="flex items-center gap-2 text-amber-400 font-medium text-sm">
          <Clock className="w-4 h-4" />
          <span>Expires in:</span>
          <span className="font-mono text-base font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            {timeLeft}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-950 px-2.5 py-1 rounded-md border border-gray-800">
          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
          <span>Polling blockchain...</span>
        </div>
      </div>

      {/* QR Code Graphic */}
      <div className="flex flex-col items-center">
        <div className="bg-white p-4 rounded-2xl mb-4 shadow-inner flex items-center justify-center min-w-[224px] min-h-[224px] border-2 border-indigo-500/10 hover:border-indigo-500/30 transition-all">
          <img
            src={qrImageUrl}
            alt="TRC20 Payment QR"
            className="w-48 h-48 block rounded-lg select-none"
          />
        </div>

        {/* Amount display */}
        <div className="text-center mb-4">
          <span className="text-xs text-gray-500 block">Total Requested</span>
          <span className="text-2xl font-black text-white tracking-wide">${parseFloat(amount).toFixed(4)} <span className="text-sm font-bold text-indigo-400">USDT</span></span>
        </div>

        {/* Address and copy button */}
        <div className="w-full max-w-md bg-gray-950 rounded-xl p-3.5 flex items-center justify-between border border-gray-800/80 mb-4 hover:border-gray-700 transition-all">
          <div className="min-w-0 flex-1 pr-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Deposit Wallet Address</span>
            <code className="text-xs text-indigo-400 font-mono block break-all mt-0.5">{walletAddress}</code>
          </div>
          <button
            onClick={copyToClipboard}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
          >
            {copied ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <Copy className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Deep link button to open Trust Wallet directly */}
        <a
          href={qrPayload}
          className="w-full max-w-md bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-3 transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20"
        >
          Pay with Trust Wallet
          <ExternalLink className="w-4 h-4" />
        </a>

        <p className="text-[11px] text-gray-500 mt-3 text-center max-w-xs">
          Scan the QR code with your wallet app to load the recipient address, or tap "Pay with Trust Wallet" on mobile to auto-fill the transaction.
        </p>
      </div>
    </div>
  );
};
export default DynamicPaymentQR;
