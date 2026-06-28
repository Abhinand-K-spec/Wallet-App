'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { ArrowDownToLine, CheckCircle2, XCircle, Clock, Loader2, ShieldCheck, ShieldAlert, AlertTriangle, RefreshCw } from 'lucide-react';

interface Deposit {
  id: string;
  txHash: string;
  amountUSD: number;
  walletAddress: string | null;
  status: string;
  adminEnteredRate: number | null;
  equivalentINR: number | null;
  createdAt: string;
  user: { email: string; userId: string };
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`;
};

interface BlockchainStatusCheckerProps {
  depositId: string;
  onAutoApprove?: () => void;
}

interface OnChainResult {
  success: boolean;
  network: string;
  fromAddress: string;
  toAddress: string;
  amountUSD: number;
  txHash?: string;
  message?: string;
}

interface BlockchainStatusData {
  depositId: string;
  txHash: string;
  submittedAmount: number;
  adminWalletAddress: string;
  onChainResult: OnChainResult;
}

const BlockchainStatusChecker = ({ depositId, onAutoApprove }: BlockchainStatusCheckerProps) => {
  const [data, setData] = useState<BlockchainStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async (isRefresh: boolean = false) => {
    setLoading(true);
    setError('');
    try {
      const url = `/admin/deposit/${depositId}/blockchain-status` + (isRefresh ? '?refresh=true' : '');
      const res = await api.get(url);
      setData(res.data);
      if (res.data.autoApproved && onAutoApprove) {
        onAutoApprove();
      }
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      console.error(axiosError);
      setError(axiosError.response?.data?.error || 'Failed to fetch blockchain status.');
    } finally {
      setLoading(false);
    }
  }, [depositId, onAutoApprove]);

  useEffect(() => {
    fetchStatus(false);
  }, [fetchStatus]);

  const handleRefresh = () => fetchStatus(true);

  if (loading) {
    return (
      <div className="mt-4 sm:ml-12 p-4 bg-gray-950 border border-gray-800 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
          <span>Verifying transaction hash on-chain...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 sm:ml-12 p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-red-400">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Verification failed: {error}</span>
        </div>
        <button
          onClick={handleRefresh}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data || !data.onChainResult) return null;

  const result = data.onChainResult;
  const isAmountMatch = Math.abs(result.amountUSD - data.submittedAmount) < 0.001;
  const isRecipientMatch = result.toAddress?.toLowerCase() === data.adminWalletAddress?.toLowerCase();
  const isHashMatch = result.txHash?.toLowerCase() === data.txHash?.toLowerCase();

  return (
    <div className="mt-4 sm:ml-12 font-sans">
      {result.success ? (
        isAmountMatch ? (
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">
                  On-Chain Verification: Success ({result.network})
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Re-verify
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5 font-sans">On-Chain Amount</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white font-mono">${result.amountUSD.toFixed(4)}</span>
                  <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-sans">Matches</span>
                </div>
              </div>

              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5 font-sans">Tx Hash Match</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-indigo-400 break-all" title={result.txHash || data.txHash}>
                    {result.txHash || data.txHash}
                  </span>
                  {isHashMatch ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-sans">Matches</span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded font-sans">Mismatch</span>
                  )}
                </div>
              </div>

              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5 font-sans">Recipient Address</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-gray-300 break-all select-all" title={result.toAddress}>
                    {result.toAddress || 'N/A'}
                  </span>
                  {isRecipientMatch ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded shrink-0 font-sans">Matches Admin Wallet</span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded shrink-0 font-sans" title={`Expected admin: ${data.adminWalletAddress}`}>Mismatch</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 font-sans">
                  On-Chain Verification: Warning (Amount Mismatch)
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Re-verify
              </button>
            </div>

            <p className="text-xs text-amber-400/90 leading-relaxed font-medium">
              Alert: The transaction hash matches, but the on-chain amount (${result.amountUSD.toFixed(4)}) does not match the submitted amount (${data.submittedAmount.toFixed(4)}).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-sans">
              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5">On-Chain Amount</span>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-red-400 font-mono">${result.amountUSD.toFixed(4)}</span>
                  <span className="text-[10px] font-semibold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Mismatch</span>
                </div>
              </div>

              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5">Tx Hash Match</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-indigo-400 break-all" title={result.txHash || data.txHash}>
                    {result.txHash || data.txHash}
                  </span>
                  {isHashMatch ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">Matches</span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Mismatch</span>
                  )}
                </div>
              </div>

              <div className="bg-gray-950 p-2.5 rounded-lg border border-gray-800">
                <span className="text-gray-500 block mb-0.5">Recipient Address</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-gray-300 break-all select-all" title={result.toAddress}>
                    {result.toAddress || 'N/A'}
                  </span>
                  {isRecipientMatch ? (
                    <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded shrink-0">Matches Admin Wallet</span>
                  ) : (
                    <span className="text-[10px] font-semibold bg-orange-500/10 text-orange-400 px-1.5 py-0.5 rounded shrink-0" title={`Expected admin: ${data.adminWalletAddress}`}>Mismatch</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs font-semibold text-red-400">
                On-Chain Verification: Failed ({result.network})
              </span>
            </div>
            <button
              onClick={handleRefresh}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Re-verify
            </button>
          </div>
          <p className="text-xs text-red-400/90 leading-relaxed">
            {result.message || 'Transaction could not be found or verified on-chain.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [processedPage, setProcessedPage] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const processedLimit = 10;
  const dispatch = useDispatch();

  useEffect(() => {
    setProcessedPage(1);
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    const fetchDeposits = async () => {
      try {
        const res = await api.get('/admin/deposits');
        if (active) {
          setDeposits(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchDeposits();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAction = async (depositId: string, action: 'APPROVED' | 'REJECTED') => {
    setActionLoading(depositId);
    try {
      await api.post(`/admin/deposit/${depositId}/verify`, {
        action,
      });
      let actionLabel = '';
      if (action === 'APPROVED') actionLabel = 'approved';
      else if (action === 'REJECTED') actionLabel = 'rejected';

      dispatch(addToast({ message: `Deposit ${actionLabel} successfully!`, type: 'success' }));
      setRefreshKey(prev => prev + 1);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Action failed';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div className="text-gray-400 p-8 font-sans">Loading deposits...</div>;

  const filterByDate = <T extends { createdAt: string }>(items: T[]) => {
    return items.filter(item => {
      if (!item.createdAt) return true;
      const dateVal = new Date(item.createdAt).getTime();
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (dateVal < start.getTime()) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (dateVal > end.getTime()) return false;
      }
      return true;
    });
  };

  const filteredDeposits = filterByDate(deposits);
  const pendingDeposits = filteredDeposits.filter(d => d.status === 'PENDING');
  const processedDeposits = filteredDeposits.filter(d => d.status !== 'PENDING');
  const processedTotalPages = Math.ceil(processedDeposits.length / processedLimit);
  const paginatedProcessedDeposits = processedDeposits.slice(
    (processedPage - 1) * processedLimit,
    processedPage * processedLimit
  );

  return (
    <div className="space-y-8 font-sans">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Verify Deposits</h1>
          <p className="text-gray-400 text-sm mt-1">Review and approve user crypto deposit submissions</p>
        </div>

        {/* Date Filter */}
        <div className="flex flex-wrap items-center gap-3 bg-gray-900 border border-gray-800 p-4 rounded-2xl shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter Deposits Date:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setProcessedPage(1);
              }}
              className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer [color-scheme:dark]"
            />
            <span className="text-gray-600 text-xs">—</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setProcessedPage(1);
              }}
              className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer [color-scheme:dark]"
            />
          </div>

          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setProcessedPage(1);
              }}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-xs font-semibold rounded-xl transition-colors text-gray-300 cursor-pointer sm:ml-auto"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* Pending Deposits */}
        <div>
          <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pending Verification ({pendingDeposits.length})
          </h2>
          {pendingDeposits.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              No pending deposits to review
            </div>
          ) : (
            <div className="space-y-4">
              {pendingDeposits.map((deposit) => (
                <div key={deposit.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl">
                          <ArrowDownToLine className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-400">User</p>
                          </div>
                          <p className="text-white font-medium">{deposit.user.email} <span className="text-gray-500 text-xs">({deposit.user.userId})</span></p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3 pl-12">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Amount</p>
                          <p className="text-lg font-bold text-white font-mono">${deposit.amountUSD.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Tx Hash</p>
                          <p className="text-sm text-indigo-400 font-mono break-all select-all">{deposit.txHash}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                          <p className="text-sm text-gray-300">{new Date(deposit.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(deposit.id, 'APPROVED')}
                        disabled={actionLoading === deposit.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        {actionLoading === deposit.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <CheckCircle2 className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(deposit.id, 'REJECTED')}
                        disabled={actionLoading === deposit.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                  <BlockchainStatusChecker 
                    depositId={deposit.id} 
                    onAutoApprove={() => {
                      dispatch(addToast({ message: 'Deposit auto-approved by blockchain match!', type: 'success' }));
                      setRefreshKey(prev => prev + 1);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Processed Deposits */}
        {processedDeposits.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-400 mb-4">Processed Deposits</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-lg overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/50 text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">Amount</th>
                      <th className="px-6 py-4 font-medium">Rate</th>
                      <th className="px-6 py-4 font-medium">INR Value</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedProcessedDeposits.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4 text-gray-300">{d.user.email}</td>
                        <td className="px-6 py-4 font-medium text-white">${d.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-400 font-mono">{d.adminEnteredRate ? `₹${d.adminEnteredRate}` : '—'}</td>
                        <td className="px-6 py-4 text-gray-300 font-mono">{d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="px-6 py-4"><span className={statusBadge(d.status)}>{d.status}</span></td>
                        <td className="px-6 py-4 text-gray-500">{new Date(d.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-800">
                {paginatedProcessedDeposits.map((d) => (
                  <div key={d.id} className="p-4 space-y-3 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300 truncate max-w-[180px]">{d.user.email}</span>
                      <span className={statusBadge(d.status)}>{d.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-500">Amount (USDT)</p>
                        <p className="font-bold text-white font-mono">${d.amountUSD.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Rate</p>
                        <p className="font-medium text-gray-400 font-mono">{d.adminEnteredRate ? `₹${d.adminEnteredRate}` : '—'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">INR Value</p>
                        <p className="font-bold text-gray-300 font-mono">
                          {d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between pt-2 border-t border-gray-800/30">
                      <span>Submitted At</span>
                      <span>{new Date(d.createdAt).toLocaleString()}</span>
                    </div>

                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {processedTotalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing Page {processedPage} of {processedTotalPages} ({processedDeposits.length} deposits total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProcessedPage(prev => Math.max(prev - 1, 1))}
                      disabled={processedPage === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setProcessedPage(prev => Math.min(prev + 1, processedTotalPages))}
                      disabled={processedPage === processedTotalPages}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        

      </div>
  );
}
