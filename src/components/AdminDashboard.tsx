'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/toastSlice';
import api from '@/api/axios';
import { Users, ArrowDownToLine, ArrowUpFromLine, Clock, Coins, Copy, Check, ExternalLink, AlertTriangle, Wallet, RefreshCw, Loader2 } from 'lucide-react';
import { useExchangeRate } from '@/context/ExchangeRateContext';

interface WalletDetails {
  address: string;
  ethBalance: number;
  usdtBalance: number;
  etherscanConfigured: boolean;
  onChainTransactions: Array<{
    hash: string;
    from: string;
    to: string;
    amountUSD: number;
    timestamp: number;
    blockNumber: string;
    tokenSymbol?: string;
  }>;
}

interface AdminStats {
  totalUsers: number;
  totalDepositsUSD: number;
  totalWithdrawalsINR: number;
  pendingRequests: number;
  walletDetails?: WalletDetails;
}

const AdminDashboard = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const { exchangeRate: appRate, refreshRate } = useExchangeRate();
  const [rateInput, setRateInput] = useState('');
  const [rateUpdating, setRateUpdating] = useState(false);

  const dispatch = useDispatch();

  useEffect(() => {
    if (appRate !== null) {
      setRateInput((prev) => {
        if (prev === '' || prev === String(appRate)) {
          return String(appRate);
        }
        return prev;
      });
    }
  }, [appRate]);

  const handleUpdateRate = async () => {
    if (!rateInput || isNaN(parseFloat(rateInput)) || parseFloat(rateInput) <= 0) {
      dispatch(addToast({ message: 'Please enter a valid exchange rate.', type: 'error' }));
      return;
    }
    setRateUpdating(true);
    try {
      const res = await api.post('/admin/settings/rate', { rate: rateInput });
      dispatch(addToast({ message: res.data.message || 'Exchange rate updated successfully.', type: 'success' }));
      await refreshRate();
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      const msg = error.response?.data?.error || 'Failed to update exchange rate.';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setRateUpdating(false);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/admin/dashboard');
        setStats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalTxs = stats?.walletDetails?.onChainTransactions || [];
  const totalPages = Math.ceil(totalTxs.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTxs = totalTxs.slice(indexOfFirstItem, indexOfLastItem);

  if (loading) return <div className="text-gray-400 font-sans p-6">Loading admin dashboard...</div>;

  return (
    <div className="space-y-6 font-sans">
      <h1 className="text-2xl font-bold text-white tracking-tight">Admin Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total Users</p>
              <h3 className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <ArrowDownToLine className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total Deposits (USDT)</p>
              <h3 className="text-2xl font-bold text-white">${stats?.totalDepositsUSD?.toFixed(4) || '0.0000'}</h3>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <ArrowUpFromLine className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total Withdrawn (INR)</p>
              <h3 className="text-2xl font-bold text-white">₹{stats?.totalWithdrawalsINR?.toLocaleString('en-IN') || '0'}</h3>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/40 to-gray-900 border border-indigo-500/20 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Pending Requests</p>
              <h3 className="text-2xl font-bold text-white">{stats?.pendingRequests || 0}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Wallet Details Section */}
      {stats?.walletDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-1 space-y-6">
            {/* Admin Wallet Details Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col justify-between shadow-lg">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  Admin Wallet Details
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                  {'TRON Mainnet'}
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Address</label>
                  <div className="flex items-center gap-2 bg-gray-950 px-3 py-2 rounded-xl border border-gray-800/80">
                    <span className="text-xs text-gray-300 font-mono break-all select-all flex-1" title={stats.walletDetails.address}>
                      {stats.walletDetails.address}
                    </span>
                    <button
                      onClick={() => handleCopy(stats.walletDetails?.address || '')}
                      className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white cursor-pointer"
                      title="Copy Address"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
                    <label className="text-xs text-gray-500 font-medium block mb-1">USDT Balance</label>
                    <p className="text-lg font-bold text-green-400">${stats.walletDetails.usdtBalance.toFixed(4)}</p>
                  </div>
                  <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
                    <label className="text-xs text-gray-500 font-medium block mb-1">
                      {stats.walletDetails.address.startsWith('T') ? 'TRX Balance' : 'ETH Balance'}
                    </label>
                    <p className="text-lg font-bold text-blue-400">
                      {stats.walletDetails.ethBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {stats.walletDetails.address.startsWith('T') ? 'TRX' : 'ETH'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {!stats.walletDetails.etherscanConfigured && (
              <div className="mt-6 p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div className="text-xs text-gray-400 leading-relaxed">
                  <span className="text-orange-400 font-semibold block mb-0.5">
                    Tronscan API Inactive
                  </span>
                  Add <code className="text-orange-300 font-mono">TRONSCAN_API_KEY</code> to your backend variables to extract live transaction logs directly.
                </div>
              </div>
            )}
            </div>

            {/* Application Exchange Rate Settings Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-indigo-400" />
                Application Exchange Rate
              </h2>
              <p className="text-xs text-gray-400 leading-relaxed">Configure the USDT to INR conversion rate applied globally for user withdrawals.</p>
              
              <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80 flex items-center justify-between">
                <span className="text-xs text-gray-400 font-medium">Active Rate:</span>
                <span className="text-lg font-bold text-emerald-400">
                  {appRate !== null ? `₹${appRate.toFixed(2)}` : 'Loading...'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Set Exchange Rate (₹ per 1.00 USDT)</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      value={rateInput}
                      onChange={e => setRateInput(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 pl-7"
                      placeholder="83.50"
                    />
                    <span className="absolute left-3 top-2.5 text-gray-500 text-sm font-sans">₹</span>
                  </div>
                </div>

                <button
                  onClick={handleUpdateRate}
                  disabled={rateUpdating}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {rateUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Update Application Rate
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-green-400" />
              On-Chain Token Transactions
            </h2>

            {stats.walletDetails.onChainTransactions.length === 0 ? (
              <div className="h-[200px] flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800 rounded-xl">
                <p className="text-gray-400 text-sm mb-1">No transaction logs retrieved</p>
                <p className="text-xs text-gray-600 max-w-[280px]">
                  {stats.walletDetails.etherscanConfigured
                    ? 'No TRC-20 token transactions found on TRON for this address.'
                    : 'Transaction scanning is disabled because the API Key is not set.'}
                </p>
              </div>
            ) : (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="pb-3 pl-2">Hash</th>
                        <th className="pb-3">From</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3 pr-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50 text-sm">
                      {currentTxs.map((tx) => (
                        <tr key={tx.hash} className="hover:bg-gray-800/20 transition-colors group">
                          <td className="py-3 pl-2 font-mono text-xs text-indigo-400 group-hover:text-indigo-300 break-all max-w-[220px] select-all">
                            <a
                              href={`https://tronscan.org/#/transaction/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 cursor-pointer break-all"
                            >
                              {tx.hash}
                              <ExternalLink className="w-3 h-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </a>
                          </td>
                          <td className="py-3 font-mono text-xs text-gray-400 max-w-[120px] truncate" title={tx.from}>
                            {tx.from}
                          </td>
                          <td className="py-3 font-semibold text-green-400">
                            {tx.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {tx.tokenSymbol || 'TRC20'}
                          </td>
                          <td className="py-3 pr-2 text-right text-xs text-gray-500">
                            {new Date(tx.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                    <p className="text-xs text-gray-500">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalTxs.length)} of {totalTxs.length} transactions
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
