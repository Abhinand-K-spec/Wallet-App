'use client';

import { useEffect, useState } from 'react';
import api from '@/api/axios';
import { ArrowDownToLine, ArrowUpFromLine, Activity, Wallet } from 'lucide-react';

interface Deposit {
  id: string;
  status: string;
  amountUSD: number;
  equivalentINR: number | null;
  adminEnteredRate: number | null;
}

interface Withdrawal {
  id: string;
  status: string;
  amountUSD: number;
  amountINR: number;
}

interface Transaction {
  id: string;
  transactionType: string;
  amountUSD: number;
  amountINR: number | null;
  status: string;
  createdAt: string;
}

interface UserProfile {
  id: string;
  userId: string;
  email: string;
  deposits: Deposit[];
  withdrawals: Withdrawal[];
  transactions: Transaction[];
}

const UserDashboard = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/user/profile');
        setProfile(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="text-gray-400 font-sans p-6">Loading dashboard...</div>;

  const totalDepositsINR = profile?.deposits?.filter((d: Deposit) => ['APPROVED', 'SUCCESS'].includes(d.status)).reduce((acc: number, d: Deposit) => acc + (d.equivalentINR ?? (d.amountUSD * (d.adminEnteredRate ?? 83.50))), 0) || 0;
  const totalWithdrawalsINR = profile?.withdrawals?.filter((w: Withdrawal) => ['APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => acc + w.amountINR, 0) || 0;
  const availableBalanceINR = totalDepositsINR - totalWithdrawalsINR;

  const totalDepositsUSD = profile?.deposits?.filter((d: Deposit) => ['APPROVED', 'SUCCESS'].includes(d.status)).reduce((acc: number, d: Deposit) => acc + d.amountUSD, 0) || 0;
  const totalWithdrawalsUSD = profile?.withdrawals?.filter((w: Withdrawal) => ['APPROVED', 'PAID'].includes(w.status)).reduce((acc: number, w: Withdrawal) => acc + w.amountUSD, 0) || 0;
  const availableBalanceUSD = totalDepositsUSD - totalWithdrawalsUSD;

  return (
    <div className="space-y-6 font-sans">
      <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-indigo-900/50 to-gray-900 border border-indigo-500/20 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Wallet className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Available Balance</p>
              <h3 className="text-3xl font-bold text-white">₹{availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-gray-500 mt-1 font-mono">approx. ${availableBalanceUSD.toFixed(2)} USDT</p>
            </div>
          </div>
        </div>

        {/* Total Deposits Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <ArrowDownToLine className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total Deposits</p>
              <h3 className="text-2xl font-bold text-white">₹{totalDepositsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-gray-500 mt-1 font-mono">${totalDepositsUSD.toFixed(2)} USDT</p>
            </div>
          </div>
        </div>

        {/* Total Withdrawals Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <ArrowUpFromLine className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-400">Total Withdrawn</p>
              <h3 className="text-2xl font-bold text-white">₹{totalWithdrawalsINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
              <p className="text-xs text-gray-500 mt-1 font-mono">${totalWithdrawalsUSD.toFixed(2)} USDT</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg">
          {profile && profile.transactions && profile.transactions.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-800/50 text-gray-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Amount (USD)</th>
                  <th className="px-6 py-4 font-medium">Amount (INR)</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {profile.transactions.slice(0, 5).map((tx: Transaction) => (
                  <tr key={tx.id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${tx.transactionType === 'DEPOSIT' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                        {tx.transactionType === 'DEPOSIT' ? <ArrowDownToLine className="w-3 h-3" /> : <ArrowUpFromLine className="w-3 h-3" />}
                        {tx.transactionType}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-200">${tx.amountUSD.toFixed(2)}</td>
                    <td className="px-6 py-4 text-gray-300">{tx.amountINR ? `₹${tx.amountINR.toLocaleString('en-IN')}` : '—'}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-medium ${
                        tx.status === 'COMPLETED' ? 'text-emerald-400' :
                        tx.status === 'PENDING' ? 'text-amber-400' : 'text-red-400'
                      }`}>{tx.status}</span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <Activity className="w-12 h-12 text-gray-700 mb-3" />
              <p>No recent transactions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
