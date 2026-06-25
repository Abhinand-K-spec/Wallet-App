'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { ArrowUpFromLine, CheckCircle2, XCircle, Clock, CreditCard, Loader2, Copy, Check, Download, ChevronDown } from 'lucide-react';

interface Withdrawal {
  id: string;
  amountUSD: number;
  amountINR: number;
  method: string;
  accountHolder: string;
  accountNumber: string | null;
  ifsc: string | null;
  walletAddress: string | null;
  status: string;
  utr: string | null;
  downloaded: boolean;
  createdAt: string;
  updatedAt: string;
  user: { email: string; userId: string };
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`;
};

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [utrInputs, setUtrInputs] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const completedLimit = 10;
  
  const dispatch = useDispatch();

  useEffect(() => {
    setCompletedPage(1);
  }, [refreshKey]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleSelectAll = (ids: string[]) => {
    const allSelected = ids.every(id => selectedIds[id]);
    setSelectedIds(prev => {
      const next = { ...prev };
      ids.forEach(id => {
        next[id] = !allSelected;
      });
      return next;
    });
  };

  const downloadData = (format: 'csv' | 'ssv') => {
    const selectedWithdrawals = withdrawals.filter(w => selectedIds[w.id]);
    if (selectedWithdrawals.length === 0) {
      dispatch(addToast({ message: 'Please select at least one request to download.', type: 'error' }));
      return;
    }

    const headers = [
      'Request ID',
      'User Email',
      'Method',
      'USDT Amount',
      'INR Amount',
      'Beneficiary Name',
      'Account Number / Wallet Address',
      'IFSC Code',
      'Status',
      'Requested Date'
    ];

    const rows = selectedWithdrawals.map(w => [
      w.id,
      w.user.email,
      w.method,
      w.amountUSD.toFixed(4),
      w.amountINR.toFixed(2),
      w.accountHolder,
      w.method === 'USDT' ? w.walletAddress : w.accountNumber,
      w.method === 'USDT' ? 'N/A' : w.ifsc,
      w.status,
      new Date(w.createdAt).toLocaleString()
    ]);

    const delimiter = format === 'ssv' ? ';' : ',';

    const content = [
      headers.join(delimiter),
      ...rows.map(row => row.map(val => {
        const stringVal = val ? String(val).replace(/"/g, '""') : '';
        return `"${stringVal}"`;
      }).join(delimiter))
    ].join('\n');

    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `withdrawals_export_${new Date().toISOString().slice(0,10)}.${format}`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Save downloaded state in database
    try {
      const ids = selectedWithdrawals.map(w => w.id);
      api.post('/admin/withdrawals/mark-downloaded', { ids }).catch(err => {
        console.error('Failed to mark withdrawals as downloaded:', err);
      });
      
      // Update local state
      setWithdrawals(prev => prev.map(w => ids.includes(w.id) ? { ...w, downloaded: true } : w));
      
      // Clear selection
      setSelectedIds({});
      dispatch(addToast({ message: `Successfully downloaded ${format.toUpperCase()} for ${selectedWithdrawals.length} requests!`, type: 'success' }));
    } catch (err) {
      console.error('Failed to mark withdrawals as downloaded:', err);
      dispatch(addToast({ message: `${format.toUpperCase()} downloaded, but failed to save status to database`, type: 'error' }));
    }

    setIsDownloadDropdownOpen(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const CopyButton = ({ text }: { text: string }) => {
    const isCopied = copiedText === text;
    return (
      <button
        type="button"
        onClick={() => handleCopy(text)}
        className="inline-flex items-center justify-center p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-1 cursor-pointer"
        title="Copy to clipboard"
      >
        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    );
  };

  useEffect(() => {
    let active = true;
    const fetchWithdrawals = async () => {
      try {
        const res = await api.get('/admin/withdrawals');
        if (active) {
          setWithdrawals(res.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchWithdrawals();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleAction = async (withdrawalId: string, action: 'APPROVED' | 'REJECTED' | 'PAID') => {
    if (action === 'PAID' && !utrInputs[withdrawalId]) {
      const isUsdt = withdrawals.find(w => w.id === withdrawalId)?.method === 'USDT';
      dispatch(addToast({ message: `Please enter a ${isUsdt ? 'transaction hash' : 'UTR number'} before marking as paid.`, type: 'error' }));
      return;
    }
    setActionLoading(withdrawalId);
    try {
      await api.post(`/admin/withdrawal/${withdrawalId}/manage`, {
        action,
        utr: action === 'PAID' ? utrInputs[withdrawalId] : undefined,
      });
      let actionLabel = '';
      if (action === 'APPROVED') actionLabel = 'approved';
      else if (action === 'REJECTED') actionLabel = 'rejected';
      else if (action === 'PAID') actionLabel = 'paid';

      dispatch(addToast({ message: `Withdrawal successfully ${actionLabel}!`, type: 'success' }));
      setRefreshKey(prev => prev + 1);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Action failed';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="text-gray-400 p-8 font-sans">Loading withdrawals...</div>
    );
  }

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'PENDING');
  const approvedWithdrawals = withdrawals.filter(w => w.status === 'APPROVED');
  const completedWithdrawals = withdrawals.filter(w => ['PAID', 'REJECTED'].includes(w.status));
  const completedTotalPages = Math.ceil(completedWithdrawals.length / completedLimit);
  const paginatedCompletedWithdrawals = completedWithdrawals.slice(
    (completedPage - 1) * completedLimit,
    completedPage * completedLimit
  );

  return (
    <div className="space-y-8 font-sans">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manage Withdrawals</h1>
          <p className="text-gray-400 text-sm mt-1">Approve, reject, or mark withdrawal requests as paid</p>
        </div>

        {/* Pending Withdrawals */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Approval ({pendingWithdrawals.length})
            </h2>
            {pendingWithdrawals.length > 0 && (
              <button
                onClick={() => toggleSelectAll(pendingWithdrawals.map(w => w.id))}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-3 py-1.5 rounded-xl border border-gray-700 transition-all cursor-pointer"
              >
                {pendingWithdrawals.every(w => selectedIds[w.id]) ? 'Deselect All Pending' : 'Select All Pending'}
              </button>
            )}
          </div>
          {pendingWithdrawals.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              No pending withdrawal requests
            </div>
          ) : (
            <div className="space-y-4">
              {pendingWithdrawals.map((w) => (
                <div key={w.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[w.id]}
                          onChange={() => toggleSelect(w.id)}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer shrink-0"
                        />
                        <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
                          <ArrowUpFromLine className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">User</p>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{w.user.email} <span className="text-gray-500 text-xs">({w.user.userId})</span></p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              w.method === 'USDT'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {w.method === 'USDT' ? 'USDT Wallet Transfer' : 'Bank Transfer'}
                            </span>
                            {w.downloaded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-800/80 text-gray-400 border-gray-700/80">
                                Already Downloaded
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3 pl-12">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">USDT Amount</p>
                          <p className="text-lg font-bold text-white">${w.amountUSD.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">INR Amount</p>
                          <p className="text-lg font-bold text-emerald-400">₹{w.amountINR.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Payout Details</p>
                          {w.method === 'USDT' ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20 mb-1">
                                USDT Crypto
                              </span>
                              <p className="text-sm text-gray-300 font-medium">{w.accountHolder}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs text-indigo-400 font-mono break-all select-all">
                                  {w.walletAddress}
                                </span>
                                <CopyButton text={w.walletAddress || ''} />
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 mb-1">
                                Bank Transfer
                              </span>
                              <p className="text-sm text-gray-300 font-medium">{w.accountHolder}</p>
                              <div className="text-xs text-gray-400 space-y-0.5 mt-0.5">
                                <div className="flex items-center gap-1">
                                  <span>A/C: <span className="font-mono text-gray-300 select-all">{w.accountNumber}</span></span>
                                  <CopyButton text={w.accountNumber || ''} />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span>IFSC: <span className="font-mono text-gray-300 select-all">{w.ifsc}</span></span>
                                  <CopyButton text={w.ifsc || ''} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Date</p>
                          <p className="text-sm text-gray-300">{new Date(w.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleAction(w.id, 'APPROVED')}
                        disabled={actionLoading === w.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(w.id, 'REJECTED')}
                        disabled={actionLoading === w.id}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer shadow-md active:scale-[0.98]"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Approved — Awaiting Payment */}
        {approvedWithdrawals.length > 0 && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Approved — Awaiting Payment ({approvedWithdrawals.length})
              </h2>
              <button
                onClick={() => toggleSelectAll(approvedWithdrawals.map(w => w.id))}
                className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold px-3 py-1.5 rounded-xl border border-gray-700 transition-all cursor-pointer"
              >
                {approvedWithdrawals.every(w => selectedIds[w.id]) ? 'Deselect All Approved' : 'Select All Approved'}
              </button>
            </div>
            <div className="space-y-4">
              {approvedWithdrawals.map((w) => (
                <div key={w.id} className="bg-gray-900 border border-blue-500/20 rounded-2xl p-6 shadow-lg">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selectedIds[w.id]}
                          onChange={() => toggleSelect(w.id)}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-950 text-indigo-600 focus:ring-indigo-500/50 cursor-pointer shrink-0"
                        />
                        <div className="p-2 bg-blue-500/10 rounded-xl shrink-0">
                          <ArrowUpFromLine className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{w.user.email}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              w.method === 'USDT'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {w.method === 'USDT' ? 'USDT Wallet Transfer' : 'Bank Transfer'}
                            </span>
                            {w.downloaded && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-gray-800/80 text-gray-400 border-gray-700/80">
                                Already Downloaded
                              </span>
                            )}
                          </div>
                          {w.method === 'USDT' ? (
                            <div className="text-sm text-gray-300 mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-semibold border border-indigo-500/20 mr-2">
                                USDT Crypto
                              </span>
                              <span className="font-medium">{w.accountHolder}</span>
                              <div className="flex items-center gap-1 mt-1 text-xs font-mono text-indigo-400 break-all select-all">
                                <span>{w.walletAddress}</span>
                                <CopyButton text={w.walletAddress || ''} />
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-300 mt-1">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 mr-2">
                                Bank Transfer
                              </span>
                              <span className="font-medium">{w.accountHolder}</span>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                                <div className="flex items-center gap-1">
                                  <span>A/C: <span className="font-mono text-gray-300 select-all">{w.accountNumber}</span></span>
                                  <CopyButton text={w.accountNumber || ''} />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span>IFSC: <span className="font-mono text-gray-300 select-all">{w.ifsc}</span></span>
                                  <CopyButton text={w.ifsc || ''} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-6 pl-12 mt-2">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Pay Amount</p>
                          <p className="text-xl font-bold text-emerald-400 font-mono">₹{w.amountINR.toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">USDT Equiv.</p>
                          <p className="text-lg font-medium text-gray-300 font-mono">${w.amountUSD.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">Approved At</p>
                          <p className="text-sm font-semibold text-blue-400 mt-0.5">{new Date(w.updatedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end gap-3 shrink-0">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          {w.method === 'USDT' ? 'TxID / Hash' : 'UTR Number'}
                        </label>
                        <input
                          type="text"
                          value={utrInputs[w.id] || ''}
                          onChange={(e) => setUtrInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                          className="w-44 bg-gray-950 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          placeholder={w.method === 'USDT' ? '0x...' : 'UTR123456789'}
                        />
                      </div>
                      <button
                        onClick={() => handleAction(w.id, 'PAID')}
                        disabled={actionLoading === w.id}
                        className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {actionLoading === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Mark Paid
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed/Rejected */}
        {completedWithdrawals.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-400 mb-4">Completed / Rejected</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-lg overflow-hidden">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/50 text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">User</th>
                      <th className="px-6 py-4 font-medium">USDT</th>
                      <th className="px-6 py-4 font-medium">INR</th>
                      <th className="px-6 py-4 font-medium">Payout Info</th>
                      <th className="px-6 py-4 font-medium">UTR / TxID</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Requested</th>
                      <th className="px-6 py-4 font-medium">Paid / Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedCompletedWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4 text-gray-300">{w.user.email}</td>
                        <td className="px-6 py-4 font-medium text-white font-mono">${w.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-300 font-mono">₹{w.amountINR.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 text-gray-400 text-xs">
                          {w.method === 'USDT' ? (
                            <>
                              <span className="text-indigo-400 font-semibold block text-[10px] mb-0.5">USDT Wallet Transfer</span>
                              <span className="font-medium text-gray-300">{w.accountHolder}</span>
                              <div className="flex items-center gap-1 font-mono text-xs break-all select-all">
                                <span title={w.walletAddress || ''}>{w.walletAddress}</span>
                                <CopyButton text={w.walletAddress || ''} />
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-emerald-400 font-semibold block text-[10px] mb-0.5">Bank Transfer</span>
                              <span className="font-medium text-gray-300">{w.accountHolder}</span>
                              <div className="flex items-center gap-1 text-xs">
                                <span className="font-mono select-all">{w.accountNumber}</span>
                                <CopyButton text={w.accountNumber || ''} />
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-indigo-400 font-mono text-xs break-all select-all">{w.utr || '—'}</td>
                        <td className="px-6 py-4"><span className={statusBadge(w.status)}>{w.status}</span></td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{new Date(w.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-800">
                {paginatedCompletedWithdrawals.map((w) => (
                  <div key={w.id} className="p-4 space-y-4 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-300 truncate max-w-[180px]">{w.user.email}</span>
                      <span className={statusBadge(w.status)}>{w.status}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-500">Amount (USDT)</p>
                        <p className="font-bold text-white font-mono">${w.amountUSD.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">Amount (INR)</p>
                        <p className="font-bold text-gray-300 font-mono">₹{w.amountINR.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 space-y-2 bg-gray-950 p-3 rounded-2xl border border-gray-850">
                      <div>
                        {w.method === 'USDT' ? (
                          <>
                            <span className="text-indigo-400 font-bold block text-[9px] uppercase tracking-wider mb-0.5">USDT Wallet Transfer</span>
                            <div className="flex justify-between items-center text-[11px] text-gray-400">
                              <span>Recipient:</span>
                              <span className="text-white font-medium">{w.accountHolder}</span>
                            </div>
                            <div className="flex flex-col text-[11px] text-gray-400 mt-1 pt-1 border-t border-gray-900">
                              <span>Wallet:</span>
                              <div className="flex items-center gap-1 font-mono text-indigo-400 break-all select-all mt-0.5">
                                <span title={w.walletAddress || ''}>{w.walletAddress}</span>
                                <CopyButton text={w.walletAddress || ''} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="text-emerald-400 font-bold block text-[9px] uppercase tracking-wider mb-0.5">Bank Transfer</span>
                            <div className="flex justify-between items-center text-[11px] text-gray-400">
                              <span>Beneficiary:</span>
                              <span className="text-white font-medium">{w.accountHolder}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1 pt-1 border-t border-gray-900">
                              <span>Account:</span>
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-gray-300 select-all">{w.accountNumber}</span>
                                <CopyButton text={w.accountNumber || ''} />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      {w.utr && (
                        <div className="flex flex-col pt-2 border-t border-gray-900 text-[11px] text-gray-400">
                          <span>UTR / TxID:</span>
                          <span className="font-mono text-indigo-400 break-all select-all mt-0.5">{w.utr}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-500 flex flex-col gap-0.5 pt-2 border-t border-gray-800/30">
                      <div className="flex justify-between">
                        <span>Requested At:</span>
                        <span>{new Date(w.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400">
                        <span>Processed At:</span>
                        <span>{new Date(w.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {completedTotalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing Page {completedPage} of {completedTotalPages} ({completedWithdrawals.length} withdrawals total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCompletedPage(prev => Math.max(prev - 1, 1))}
                      disabled={completedPage === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCompletedPage(prev => Math.min(prev + 1, completedTotalPages))}
                      disabled={completedPage === completedTotalPages}
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

        {/* Floating Action Bar for Selected Items */}
        {Object.values(selectedIds).filter(Boolean).length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-950 border border-indigo-500/30 rounded-2xl px-6 py-4 flex items-center gap-6 shadow-2xl z-50 animate-fade-in-up">
            <span className="text-sm font-semibold text-white">
              {Object.values(selectedIds).filter(Boolean).length} requests selected
            </span>
            <div className="flex gap-2 relative">
              <button
                onClick={() => { setSelectedIds({}); setIsDownloadDropdownOpen(false); }}
                className="px-4 py-2 hover:bg-gray-900 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Clear Selection
              </button>
              <div className="relative">
                <button
                  onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {isDownloadDropdownOpen && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-xl py-1 z-50">
                    <button
                      onClick={() => downloadData('csv')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-850 text-gray-300 hover:text-white text-xs font-semibold cursor-pointer"
                    >
                      CSV (Comma Separated)
                    </button>
                    <button
                      onClick={() => downloadData('ssv')}
                      className="w-full text-left px-4 py-2 hover:bg-gray-850 text-gray-300 hover:text-white text-xs font-semibold cursor-pointer"
                    >
                      Excel / SSV (Semicolon Separated)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
