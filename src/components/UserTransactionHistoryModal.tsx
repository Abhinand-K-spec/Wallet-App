'use client';

import { useState, useEffect } from 'react';
import api from '@/api/axios';
import {
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  AlertCircle,
  FileText,
  CreditCard,
  Layers
} from 'lucide-react';

interface UserItem {
  id: string;
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  balanceUSD: number;
  balanceINR: number;
}

interface UserTransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserItem | null;
}

interface DepositRecord {
  id: string;
  userId: string;
  walletAddress: string;
  txHash: string;
  amountUSD: number;
  equivalentINR: number;
  adminEnteredRate: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface WithdrawalRecord {
  id: string;
  userId: string;
  amountUSD: number;
  amountINR: number;
  method: 'BANK' | 'USDT';
  accountHolder: string;
  accountNumber?: string;
  ifsc?: string;
  walletAddress?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface TransactionRecord {
  id: string;
  userId: string;
  transactionType: 'DEPOSIT' | 'WITHDRAWAL';
  amountUSD: number;
  amountINR: number;
  reference: string;
  status: string;
  createdAt: string;
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
    EXPIRED: 'bg-gray-500/10 text-gray-400 border-gray-700/20',
  };
  const className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-700/20'}`;
  return <span className={className}>{status}</span>;
};

export default function UserTransactionHistoryModal({
  isOpen,
  onClose,
  user
}: UserTransactionHistoryModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'ledger' | 'deposits' | 'withdrawals'>('ledger');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (isOpen && user) {
      setLoading(true);
      setError('');
      setTransactions([]);
      setDeposits([]);
      setWithdrawals([]);
      setActiveTab('ledger');
      setSearchQuery('');
      setStartDate('');
      setEndDate('');

      const fetchHistory = async () => {
        try {
          const res = await api.get(`/admin/user/${user.id}/transactions`);
          setTransactions(res.data.transactions || []);
          setDeposits(res.data.deposits || []);
          setWithdrawals(res.data.withdrawals || []);
        } catch (err: any) {
          console.error(err);
          const msg = err.response?.data?.error || 'Failed to fetch user transaction history.';
          setError(msg);
        } finally {
          setLoading(false);
        }
      };

      fetchHistory();
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  // Date filtering helper
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

  const dateFilteredTransactions = filterByDate(transactions);
  const dateFilteredDeposits = filterByDate(deposits);
  const dateFilteredWithdrawals = filterByDate(withdrawals);

  // Calculators for Stats (using approved / success statuses only, from the date-filtered lists!)
  const totalDepositsUSD = dateFilteredDeposits
    .filter(d => ['APPROVED', 'SUCCESS'].includes(d.status))
    .reduce((sum, d) => sum + d.amountUSD, 0);

  const totalDepositsINR = dateFilteredDeposits
    .filter(d => ['APPROVED', 'SUCCESS'].includes(d.status))
    .reduce((sum, d) => sum + (d.equivalentINR || 0), 0);

  const totalWithdrawalsUSD = dateFilteredWithdrawals
    .filter(w => ['APPROVED', 'PAID'].includes(w.status))
    .reduce((sum, w) => sum + w.amountUSD, 0);

  const totalWithdrawalsINR = dateFilteredWithdrawals
    .filter(w => ['APPROVED', 'PAID'].includes(w.status))
    .reduce((sum, w) => sum + w.amountINR, 0);

  // Quick filter for search using the date-filtered arrays!
  const filteredTransactions = dateFilteredTransactions.filter(t => 
    t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.reference && t.reference.toLowerCase().includes(searchQuery.toLowerCase())) ||
    t.transactionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDeposits = dateFilteredDeposits.filter(d => 
    d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.txHash && d.txHash.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (d.walletAddress && d.walletAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
    d.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredWithdrawals = dateFilteredWithdrawals.filter(w => 
    w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.accountHolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.accountNumber && w.accountNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (w.walletAddress && w.walletAddress.toLowerCase().includes(searchQuery.toLowerCase())) ||
    w.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md font-sans">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Transaction History: <span className="font-mono text-indigo-400 font-semibold">{user.userId}</span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Full ledger audit, deposits, and withdrawals for <span className="text-gray-300 font-medium">{user.email}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-800 text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer border border-transparent hover:border-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
              <span className="text-sm text-gray-400 font-medium">Fetching transaction ledger data...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto gap-4">
              <div className="p-3 bg-red-500/10 text-red-400 rounded-2xl border border-red-500/20">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Error Loading History</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{error}</p>
              </div>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-750 text-white text-xs font-semibold rounded-xl border border-gray-700 transition-colors"
              >
                Close Modal
              </button>
            </div>
          ) : (
            <>
              {/* Financial Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {/* Balance Card */}
                <div className="bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/20 rounded-2xl p-5 shadow-sm transition-all flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Current Balance</p>
                    <h3 className="text-lg font-bold text-white mt-0.5 font-mono">
                      ₹{user.balanceINR?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      ${user.balanceUSD?.toFixed(4) || '0.0000'} USDT
                    </p>
                  </div>
                </div>

                {/* Deposits Card */}
                <div className="bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/20 rounded-2xl p-5 shadow-sm transition-all flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total Deposits</p>
                    <h3 className="text-lg font-bold text-white mt-0.5 font-mono">
                      ₹{totalDepositsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      ${totalDepositsUSD.toFixed(2)} USDT
                    </p>
                  </div>
                </div>

                {/* Withdrawals Card */}
                <div className="bg-rose-500/5 border border-rose-500/10 hover:border-rose-500/20 rounded-2xl p-5 shadow-sm transition-all flex items-center gap-4">
                  <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Total Withdrawals</p>
                    <h3 className="text-lg font-bold text-white mt-0.5 font-mono">
                      ₹{totalWithdrawalsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                      ${totalWithdrawalsUSD.toFixed(2)} USDT
                    </p>
                  </div>
                </div>
              </div>

              {/* Toolbar: Tabs & Search */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-gray-800 pb-4">
                {/* Tabs */}
                <div className="flex bg-gray-950 p-1 rounded-xl border border-gray-800/80 w-full sm:w-auto">
                  <button
                    onClick={() => setActiveTab('ledger')}
                    className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'ledger'
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/15'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                    }`}
                  >
                    Ledger entries ({dateFilteredTransactions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('deposits')}
                    className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'deposits'
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/15'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                    }`}
                  >
                    Deposits ({dateFilteredDeposits.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('withdrawals')}
                    className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                      activeTab === 'withdrawals'
                        ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/15'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/50'
                    }`}
                  >
                    Withdrawals ({dateFilteredWithdrawals.length})
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-gray-955 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter */}
              <div className="flex flex-wrap items-center gap-3 bg-gray-900/60 border border-gray-800 p-3.5 rounded-2xl shadow-lg">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Date Range:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-gray-950 border border-gray-850 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]"
                  />
                  <span className="text-gray-655 text-xs">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="bg-gray-950 border border-gray-855 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer [color-scheme:dark]"
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all cursor-pointer sm:ml-auto"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Tab Content Display */}
              <div className="overflow-x-auto border border-gray-800 rounded-2xl bg-gray-950/40">
                {activeTab === 'ledger' && (
                  <div>
                    {filteredTransactions.length === 0 ? (
                      <div className="text-center py-16 px-4">
                        <FileText className="w-10 h-10 text-gray-700 mx-auto mb-2.5" />
                        <p className="text-xs text-gray-400">No ledger transactions found.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/70">
                            <th className="py-3 px-5">Transaction ID</th>
                            <th className="py-3 px-5">Type</th>
                            <th className="py-3 px-5">USD Amount</th>
                            <th className="py-3 px-5">INR Amount</th>
                            <th className="py-3 px-5">Reference</th>
                            <th className="py-3 px-5">Status</th>
                            <th className="py-3 px-5">Created At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40 text-xs">
                          {filteredTransactions.map(t => (
                            <tr key={t.id} className="hover:bg-gray-800/10 transition-colors">
                              <td className="py-3 px-5 font-mono text-[10px] text-gray-400">{t.id}</td>
                              <td className="py-3 px-5 font-semibold">
                                {t.transactionType === 'DEPOSIT' ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                    DEPOSIT
                                  </span>
                                ) : (
                                  <span className="text-rose-400 flex items-center gap-1">
                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                    WITHDRAWAL
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-200">
                                {t.transactionType === 'DEPOSIT' ? '+' : '-'}${t.amountUSD.toFixed(4)}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-300">
                                {t.amountINR !== null && t.amountINR !== undefined ? (
                                  `${t.transactionType === 'DEPOSIT' ? '+' : '-'}₹${t.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-3 px-5 font-mono text-[10px] text-indigo-400 truncate max-w-[120px]" title={t.reference}>
                                {t.reference || '—'}
                              </td>
                              <td className="py-3 px-5">{statusBadge(t.status)}</td>
                              <td className="py-3 px-5 text-gray-500">
                                {new Date(t.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'deposits' && (
                  <div>
                    {filteredDeposits.length === 0 ? (
                      <div className="text-center py-16 px-4">
                        <TrendingUp className="w-10 h-10 text-gray-700 mx-auto mb-2.5" />
                        <p className="text-xs text-gray-400">No deposit submissions found.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[850px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/70">
                            <th className="py-3 px-5">ID / Tx Hash</th>
                            <th className="py-3 px-5">Wallet Address</th>
                            <th className="py-3 px-5">Amount USD</th>
                            <th className="py-3 px-5">Exchange Rate</th>
                            <th className="py-3 px-5">Equivalent INR</th>
                            <th className="py-3 px-5">Status</th>
                            <th className="py-3 px-5">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40 text-xs">
                          {filteredDeposits.map(d => (
                            <tr key={d.id} className="hover:bg-gray-800/10 transition-colors">
                              <td className="py-3 px-5 space-y-0.5">
                                <div className="font-mono text-[10px] text-gray-400">ID: {d.id}</div>
                                {d.txHash && (
                                  <div className="font-mono text-[10px] text-indigo-400 select-all truncate max-w-[200px]" title={d.txHash}>
                                    Tx: {d.txHash}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-5 font-mono text-[10px] text-gray-400 max-w-[140px] truncate select-all" title={d.walletAddress}>
                                {d.walletAddress || '—'}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-200">
                                ${d.amountUSD.toFixed(4)}
                              </td>
                              <td className="py-3 px-5 font-mono text-gray-400">
                                {d.adminEnteredRate ? `₹${d.adminEnteredRate.toFixed(2)}` : '—'}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-300">
                                {d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                              </td>
                              <td className="py-3 px-5">{statusBadge(d.status)}</td>
                              <td className="py-3 px-5 text-gray-500">
                                {new Date(d.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {activeTab === 'withdrawals' && (
                  <div>
                    {filteredWithdrawals.length === 0 ? (
                      <div className="text-center py-16 px-4">
                        <CreditCard className="w-10 h-10 text-gray-700 mx-auto mb-2.5" />
                        <p className="text-xs text-gray-400">No withdrawal submissions found.</p>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse min-w-[900px]">
                        <thead>
                          <tr className="border-b border-gray-800 text-[10px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-950/70">
                            <th className="py-3 px-5">ID / Details</th>
                            <th className="py-3 px-5">Method</th>
                            <th className="py-3 px-5">Target Destination</th>
                            <th className="py-3 px-5">Amount USD</th>
                            <th className="py-3 px-5">Amount INR</th>
                            <th className="py-3 px-5">Status</th>
                            <th className="py-3 px-5">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/40 text-xs">
                          {filteredWithdrawals.map(w => (
                            <tr key={w.id} className="hover:bg-gray-800/10 transition-colors">
                              <td className="py-3 px-5 space-y-0.5">
                                <div className="font-mono text-[10px] text-gray-400">ID: {w.id}</div>
                                {w.accountHolder && (
                                  <div className="text-[10px] text-gray-300 font-medium">
                                    Holder: {w.accountHolder}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-5">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  w.method === 'USDT' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {w.method}
                                </span>
                              </td>
                              <td className="py-3 px-5 space-y-0.5">
                                {w.method === 'USDT' ? (
                                  <div className="font-mono text-[10px] text-gray-400 max-w-[180px] truncate select-all" title={w.walletAddress}>
                                    {w.walletAddress || '—'}
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-gray-400 space-y-0.5">
                                    <div>Acc: {w.accountNumber || '—'}</div>
                                    <div>IFSC: {w.ifsc || '—'}</div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-200">
                                {w.method === 'USDT' ? `$${w.amountUSD.toFixed(4)}` : '—'}
                              </td>
                              <td className="py-3 px-5 font-mono font-medium text-gray-300">
                                ₹{w.amountINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-3 px-5">{statusBadge(w.status)}</td>
                              <td className="py-3 px-5 text-gray-500">
                                {new Date(w.createdAt).toLocaleString(undefined, {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 bg-gray-950/40 text-right shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 hover:text-white text-gray-300 text-xs font-semibold rounded-xl border border-gray-700 transition-all cursor-pointer"
          >
            Close Window
          </button>
        </div>

      </div>
    </div>
  );
}
