'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { ArrowDownToLine, ArrowUpFromLine, Activity, Clock, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';
import UserPaymentProofModal from '@/components/UserPaymentProofModal';

interface Deposit {
  id: string;
  txHash: string;
  amountUSD: number;
  status: string;
  equivalentINR: number | null;
  createdAt: string;
  updatedAt: string;
}

interface Withdrawal {
  id: string;
  amountUSD: number;
  amountINR: number;
  method: string;
  accountHolder: string;
  status: string;
  utr: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED':
    case 'APPROVED':
    case 'PAID':
    case 'SUCCESS':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'PENDING':
      return <Clock className="w-4 h-4 text-amber-400" />;
    case 'REJECTED':
    case 'FAILED':
    case 'EXPIRED':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Activity className="w-4 h-4 text-gray-400" />;
  }
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    APPROVED: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    PAID: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/30',
    FAILED: 'bg-red-500/10 text-red-400 border-red-500/30',
    EXPIRED: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`;
};

type TabType = 'all' | 'deposits' | 'withdrawals';

export default function HistoryPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const itemsPerPage = 10;

  const dispatch = useDispatch();

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/user/transactions');
        setDeposits(res.data.deposits);
        setWithdrawals(res.data.withdrawals);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="text-gray-400 p-8 font-sans">Loading history...</div>;

  const combinedTransactions = [
    ...deposits.map((d) => ({
      id: d.id,
      transactionType: 'DEPOSIT',
      amountUSD: d.amountUSD,
      amountINR: d.equivalentINR,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      method: null,
      utr: d.txHash,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      transactionType: 'WITHDRAWAL',
      amountUSD: w.amountUSD,
      amountINR: w.amountINR,
      status: w.status,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      method: w.method,
      utr: w.utr,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const paginatedTransactions = combinedTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedDeposits = deposits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedWithdrawals = withdrawals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalPagesAll = Math.ceil(combinedTransactions.length / itemsPerPage);
  const totalPagesDeposits = Math.ceil(deposits.length / itemsPerPage);
  const totalPagesWithdrawals = Math.ceil(withdrawals.length / itemsPerPage);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'all', label: 'All Transactions', count: combinedTransactions.length },
    { key: 'deposits', label: 'Deposits', count: deposits.length },
    { key: 'withdrawals', label: 'Withdrawals', count: withdrawals.length },
  ];

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Transaction History</h1>
        <p className="text-gray-400 text-sm mt-1 font-sans">View all your deposits, withdrawals, and transactions</p>
      </div>

      {/* Tab Selector */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${activeTab === tab.key
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
          >
            {tab.label} <span className="ml-1 text-xs opacity-70 font-mono">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* All Transactions Tab */}
      {activeTab === 'all' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {combinedTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Activity className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No transactions yet</p>
              <p className="text-sm mt-1">Make a deposit or withdrawal to see your transaction history</p>
            </div>
          ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/50 text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Type</th>
                      <th className="px-6 py-4 font-medium">Amount (USDT)</th>
                      <th className="px-6 py-4 font-medium">Amount (INR)</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit ${tx.transactionType === 'DEPOSIT' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
                              }`}>
                              {tx.transactionType === 'DEPOSIT'
                                ? <ArrowDownToLine className="w-3 h-3" />
                                : <ArrowUpFromLine className="w-3 h-3 text-emerald-400" />}
                              {tx.transactionType}
                            </span>
                            {tx.transactionType === 'WITHDRAWAL' && tx.method && (
                              <span className={`text-[10px] font-semibold w-fit px-1.5 py-0.5 rounded border ${tx.method === 'USDT'
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}>
                                {tx.method === 'USDT' ? 'Wallet Transfer (USDT)' : 'Bank Transfer (INR)'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-medium text-white">${tx.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-300">{tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={statusBadge(tx.status)}>
                              {statusIcon(tx.status)}
                              {tx.status}
                            </span>
                            {tx.status === 'APPROVED' && tx.transactionType === 'WITHDRAWAL' && (
                              <span className="text-[10px] text-blue-400 font-semibold block leading-tight mt-0.5">
                                The amount will credit in your ac within 3 hours
                              </span>
                            )}
                            {(tx.status === 'PAID' || tx.status === 'COMPLETED' || tx.status === 'SUCCESS') && tx.utr && (
                              <span className="text-[10px] text-indigo-400 font-mono block leading-tight mt-0.5 select-all">
                                TxID/UTR: {tx.utr}
                              </span>
                            )}
                            {['PAID', 'COMPLETED', 'SUCCESS', 'APPROVED'].includes(tx.status) && tx.transactionType === 'WITHDRAWAL' && (
                               <button
                                 onClick={() => {
                                   setSelectedRequestId(tx.id);
                                   setIsProofModalOpen(true);
                                 }}
                                 className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 mt-1.5 cursor-pointer transition-colors w-fit border border-indigo-500/20 bg-indigo-500/5 px-2 py-0.5 rounded"
                               >
                                 <FileText className="w-3 h-3" /> View Receipt
                               </button>
                             )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500">
                          <div>{new Date(tx.createdAt).toLocaleString()}</div>
                          {(tx.status === 'PAID' || tx.status === 'COMPLETED' || tx.status === 'SUCCESS') && (
                            <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                              Paid: {new Date(tx.updatedAt).toLocaleString()}
                            </div>
                          )}
                          {tx.status === 'APPROVED' && (
                            <div className="text-[10px] text-blue-400 font-semibold mt-1">
                              Approved: {new Date(tx.updatedAt).toLocaleString()}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile list view */}
              <div className="md:hidden divide-y divide-gray-800">
                {paginatedTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 space-y-3 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border ${tx.transactionType === 'DEPOSIT' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>
                          {tx.transactionType === 'DEPOSIT'
                            ? <ArrowDownToLine className="w-3 h-3" />
                            : <ArrowUpFromLine className="w-3 h-3 text-emerald-400" />}
                          {tx.transactionType}
                        </span>
                        {tx.transactionType === 'WITHDRAWAL' && tx.method && (
                          <span className={`text-[9px] font-semibold w-fit px-1.5 py-0.5 rounded border ${tx.method === 'USDT'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                            {tx.method === 'USDT' ? 'Wallet (USDT)' : 'Bank (INR)'}
                          </span>
                        )}
                      </div>
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
                          {tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                    </div>
                    {tx.utr && (
                      <div className="text-[10px] bg-gray-950 p-2 rounded border border-gray-855 font-mono text-indigo-400 break-all select-all">
                        TxID/UTR: {tx.utr}
                      </div>
                    )}
                    {['PAID', 'COMPLETED', 'SUCCESS', 'APPROVED'].includes(tx.status) && tx.transactionType === 'WITHDRAWAL' && (
                      <button
                        onClick={() => {
                          setSelectedRequestId(tx.id);
                          setIsProofModalOpen(true);
                        }}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center justify-center gap-1 mt-2 cursor-pointer transition-colors border border-indigo-500/20 bg-indigo-500/5 px-3 py-1.5 rounded-lg w-full"
                      >
                        <FileText className="w-3.5 h-3.5" /> View Receipt
                      </button>
                    )}
                    {tx.status === 'APPROVED' && tx.transactionType === 'WITHDRAWAL' && (
                      <p className="text-[9px] text-blue-400 font-medium">
                        The amount will credit in your ac after 3 hours
                      </p>
                    )}
                    <div className="text-[10px] text-gray-500 flex flex-col gap-0.5 pt-2 border-t border-gray-800/30">
                      <div className="flex justify-between">
                        <span>Date Requested:</span>
                        <span>{new Date(tx.createdAt).toLocaleString()}</span>
                      </div>
                      {(tx.status === 'PAID' || tx.status === 'COMPLETED' || tx.status === 'SUCCESS') && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Paid Date:</span>
                          <span>{new Date(tx.updatedAt).toLocaleString()}</span>
                        </div>
                      )}
                      {tx.status === 'APPROVED' && (
                        <div className="flex justify-between text-blue-400">
                          <span>Approved Date:</span>
                          <span>{new Date(tx.updatedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPagesAll > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing page {currentPage} of {totalPagesAll} ({combinedTransactions.length} transactions total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesAll))}
                      disabled={currentPage === totalPagesAll}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Deposits Tab */}
      {activeTab === 'deposits' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {deposits.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ArrowDownToLine className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No deposits yet</p>
              <p className="text-sm mt-1">Submit a crypto deposit to get started</p>
            </div>
          ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/50 text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Tx Hash</th>
                      <th className="px-6 py-4 font-medium">USDT</th>
                      <th className="px-6 py-4 font-medium">INR Value</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedDeposits.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-indigo-400 text-xs break-all select-all">{d.txHash}</td>
                        <td className="px-6 py-4 font-medium text-white">${d.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-300">{d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}</td>
                        <td className="px-6 py-4">
                          <span className={statusBadge(d.status)}>
                            {statusIcon(d.status)}
                            {d.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{new Date(d.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-800">
                {paginatedDeposits.map((d) => (
                  <div key={d.id} className="p-4 space-y-3 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold border bg-green-500/10 text-green-400 border-green-500/10">
                        DEPOSIT
                      </span>
                      <span className={statusBadge(d.status)}>
                        {d.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-500">USDT Amount</p>
                        <p className="font-bold text-white font-mono">${d.amountUSD.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">INR Value</p>
                        <p className="font-bold text-gray-300 font-mono">
                          {d.equivalentINR ? `₹${d.equivalentINR.toLocaleString('en-IN')}` : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] bg-gray-950 p-2 rounded border border-gray-855 font-mono text-indigo-400 break-all select-all">
                      TxID: {d.txHash}
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between pt-2 border-t border-gray-800/30">
                      <span>Date submitted</span>
                      <span>{new Date(d.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>


              {/* Pagination Controls */}
              {totalPagesDeposits > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing page {currentPage} of {totalPagesDeposits} ({deposits.length} deposits total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesDeposits))}
                      disabled={currentPage === totalPagesDeposits}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Withdrawals Tab */}
      {activeTab === 'withdrawals' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {withdrawals.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <ArrowUpFromLine className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="text-lg font-medium">No withdrawals yet</p>
              <p className="text-sm mt-1">Request a withdrawal to see it here</p>
            </div>
          ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-800/50 text-gray-400">
                    <tr>
                      <th className="px-6 py-4 font-medium">Method</th>
                      <th className="px-6 py-4 font-medium">Holder</th>
                      <th className="px-6 py-4 font-medium">USDT</th>
                      <th className="px-6 py-4 font-medium">INR</th>
                      <th className="px-6 py-4 font-medium">UTR / TxID</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium">Requested</th>
                      <th className="px-6 py-4 font-medium">Paid / Processed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {paginatedWithdrawals.map((w) => (
                      <tr key={w.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${w.method === 'USDT'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                            {w.method === 'USDT' ? 'Wallet (USDT)' : 'Bank (INR)'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-300">{w.accountHolder}</td>
                        <td className="px-6 py-4 font-medium text-white">${w.amountUSD.toFixed(4)}</td>
                        <td className="px-6 py-4 text-gray-300 font-mono">₹{w.amountINR.toLocaleString('en-IN')}</td>
                        <td className="px-6 py-4 font-mono text-indigo-400 text-xs break-all select-all">{w.utr || '—'}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <span className={statusBadge(w.status)}>
                              {statusIcon(w.status)}
                              {w.status}
                            </span>
                            {w.status === 'APPROVED' && (
                              <span className="text-[10px] text-blue-400 font-semibold block leading-tight mt-0.5">
                                The amount will credit in your ac after 3 hours
                              </span>
                            )}
                            {(w.status === 'PAID' || w.status === 'COMPLETED') && w.utr && (
                              <span className="text-[10px] text-indigo-400 font-mono block break-all leading-tight mt-0.5 select-all">
                                TxID/UTR: {w.utr}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">{new Date(w.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {w.status === 'PENDING' ? '—' : new Date(w.updatedAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-800">
                {paginatedWithdrawals.map((w) => (
                  <div key={w.id} className="p-4 space-y-3 hover:bg-gray-800/10 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${w.method === 'USDT'
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                        {w.method === 'USDT' ? 'Wallet (USDT)' : 'Bank (INR)'}
                      </span>
                      <span className={statusBadge(w.status)}>
                        {w.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-[10px] text-gray-500">USDT Amount</p>
                        <p className="font-bold text-white font-mono">${w.amountUSD.toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">INR Amount</p>
                        <p className="font-bold text-gray-300 font-mono">₹{w.amountINR.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 space-y-1 bg-gray-950 p-2.5 rounded border border-gray-855">
                      <div className="flex justify-between">
                        <span className="text-[10px] text-gray-500">Beneficiary:</span>
                        <span className="font-medium text-white">{w.accountHolder}</span>
                      </div>
                      {w.utr && (
                        <div className="flex flex-col font-mono text-[10px] text-indigo-400 select-all pt-1 border-t border-gray-800/40">
                          <span className="text-[9px] text-gray-500">UTR / TxID:</span>
                          <span className="break-all mt-0.5">{w.utr}</span>
                        </div>
                      )}
                    </div>
                    {w.status === 'APPROVED' && (
                      <p className="text-[9px] text-blue-400 font-medium">
                        The amount will credit in your ac after 3 hours
                      </p>
                    )}
                    <div className="text-[10px] text-gray-500 flex flex-col gap-0.5 pt-2 border-t border-gray-800/30">
                      <div className="flex justify-between">
                        <span>Date Requested:</span>
                        <span>{new Date(w.createdAt).toLocaleString()}</span>
                      </div>
                      {w.status !== 'PENDING' && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Processed Date:</span>
                          <span>{new Date(w.updatedAt).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPagesWithdrawals > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing page {currentPage} of {totalPagesWithdrawals} ({withdrawals.length} withdrawals total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPagesWithdrawals))}
                      disabled={currentPage === totalPagesWithdrawals}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedRequestId && (
        <UserPaymentProofModal
          isOpen={isProofModalOpen}
          onClose={() => {
            setIsProofModalOpen(false);
            setSelectedRequestId(null);
          }}
          paymentRequestId={selectedRequestId}
        />
      )}
    </div>
  );
}
