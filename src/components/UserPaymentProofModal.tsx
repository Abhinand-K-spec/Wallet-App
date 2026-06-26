'use client';

import { useState, useEffect } from 'react';
import api from '@/api/axios';
import {
  X,
  CheckCircle2,
  FileText,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';

interface UserPaymentProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentRequestId: string;
}

export default function UserPaymentProofModal({
  isOpen,
  onClose,
  paymentRequestId
}: UserPaymentProofModalProps) {
  const [proof, setProof] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && paymentRequestId) {
      setLoading(true);
      setError('');
      setProof(null);

      const fetchProof = async () => {
        try {
          const res = await api.get(`/user/payment-proof?paymentRequestId=${paymentRequestId}`);
          if (res.data.hasProof === false) {
            setError('No payment proof uploaded for this transaction.');
          } else {
            setProof(res.data);
          }
        } catch (err: any) {
          console.error(err);
          const msg = err.response?.data?.error || 'No payment proof uploaded for this transaction.';
          setError(msg);
        } finally {
          setLoading(false);
        }
      };

      fetchProof();
    }
  }, [isOpen, paymentRequestId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md font-sans">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Verified Payment Proof</h3>
              <p className="text-xs text-emerald-400 mt-0.5 font-semibold flex items-center gap-1">
                Verified by GetPay Finance Admin
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
              <span className="text-sm text-gray-400 font-medium">Fetching verified receipt...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Transaction Receipt Awaiting Upload</h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  The admin has not uploaded a payment proof slip for this request yet. Once uploaded and verified, the official receipt will appear here.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-white text-xs font-semibold rounded-xl border border-gray-800 transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              
              {/* Left Column: Image slip preview */}
              <div className="bg-gray-950 border border-gray-850 rounded-2xl flex flex-col overflow-hidden min-h-[300px]">
                <div className="flex items-center justify-between p-3 border-b border-gray-850 bg-gray-900/60 shrink-0">
                  <span className="text-xs font-semibold text-gray-400">Official Payment Slip</span>
                  <a
                    href={`/api/admin/payment-proof/${proof.id}/download`}
                    download
                    className="p-1 bg-gray-950 hover:bg-gray-850 text-gray-300 rounded border border-gray-800 transition-colors flex items-center justify-center"
                    title="Download original receipt image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[radial-gradient(#1e1b4b1a_1px,transparent_1px)] bg-[size:16px_16px]">
                  <a href={proof.originalFileUrl} target="_blank" rel="noopener noreferrer" className="cursor-zoom-in" title="View full size image">
                    <img
                      src={proof.originalFileUrl}
                      alt="Verified Payment Proof Receipt"
                      className="max-h-[45vh] max-w-full object-contain rounded-lg border border-gray-850 shadow-md transition-all hover:scale-[1.01]"
                    />
                  </a>
                </div>
              </div>

              {/* Right Column: Transaction Details List */}
              <div className="flex flex-col border border-gray-850 bg-gray-950/20 rounded-2xl p-5 space-y-4">
                <div className="border-b border-gray-850 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Receipt Details</span>
                </div>

                <div className="space-y-3.5 text-left text-xs font-sans">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-850 flex items-center justify-between">
                    <span className="text-gray-500 font-medium">Verified Status</span>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      VERIFIED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                      <span className="text-gray-500 block mb-0.5">Amount</span>
                      <span className="text-sm font-bold text-white font-mono">${proof.amount?.toFixed(2) || '—'}</span>
                    </div>
                    <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                      <span className="text-gray-500 block mb-0.5">Currency</span>
                      <span className="text-sm font-bold text-white font-mono">{proof.currency || '—'}</span>
                    </div>
                  </div>

                  <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                    <span className="text-gray-500 block mb-0.5">UTR / Tx Reference</span>
                    <span className="text-xs font-bold text-indigo-400 font-mono break-all select-all">{proof.reference || '—'}</span>
                  </div>

                  {proof.bank && (
                    <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                      <span className="text-gray-500 block mb-0.5">Bank Partner</span>
                      <span className="font-semibold text-gray-200">{proof.bank}</span>
                    </div>
                  )}

                  {proof.sender && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                        <span className="text-gray-500 block mb-0.5">Sender</span>
                        <span className="font-semibold text-gray-200 truncate block">{proof.sender}</span>
                      </div>
                      <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                        <span className="text-gray-500 block mb-0.5">Receiver</span>
                        <span className="font-semibold text-gray-200 truncate block">{proof.receiver}</span>
                      </div>
                    </div>
                  )}

                  {(proof.account || proof.wallet) && (
                    <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60 font-mono">
                      {proof.wallet ? (
                        <>
                          <span className="text-gray-500 block mb-0.5 font-sans">Destination Wallet Address</span>
                          <span className="text-gray-200 break-all select-all">{proof.wallet}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-gray-500 block mb-0.5 font-sans">Destination Account Number</span>
                          <span className="text-gray-200 select-all">{proof.account}</span>
                        </>
                      )}
                    </div>
                  )}

                  {(proof.date || proof.time) && (
                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                        <span className="text-gray-500 block mb-0.5 font-sans">Receipt Date</span>
                        <span className="text-gray-300">{proof.date || '—'}</span>
                      </div>
                      <div className="bg-gray-950/40 p-3 rounded-xl border border-gray-850/60">
                        <span className="text-gray-500 block mb-0.5 font-sans">Receipt Time</span>
                        <span className="text-gray-300">{proof.time || '—'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
