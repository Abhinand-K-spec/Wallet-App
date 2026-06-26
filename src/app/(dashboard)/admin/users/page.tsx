'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { addToast } from '@/store/toastSlice';
import type { RootState } from '@/store/store';
import api from '@/api/axios';
import { Users, UserX, UserCheck, Shield, Search, Loader2, History } from 'lucide-react';
import UserTransactionHistoryModal from '@/components/UserTransactionHistoryModal';

interface UserItem {
  id: string;
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  balanceUSD: number;
  balanceINR: number;
  depositRates: number[];
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    SUSPENDED: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[status] || 'bg-gray-500/10 text-gray-400'}`;
};

const roleBadge = (role: string) => {
  const styles: Record<string, string> = {
    ADMIN: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    USER: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  };
  return `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${styles[role] || 'bg-gray-500/10 text-gray-400'}`;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Search and Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  
  // History Modal State
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 10;
  
  const [refreshKey, setRefreshKey] = useState(0);
  const dispatch = useDispatch();
  const router = useRouter();
  
  // Currently logged in admin
  const { user: currentAdmin } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    let active = true;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        if (search) queryParams.append('search', search);
        if (statusFilter) queryParams.append('status', statusFilter);
        if (roleFilter) queryParams.append('role', roleFilter);

        const res = await api.get(`/admin/users?${queryParams.toString()}`);
        if (active) {
          setUsers(res.data.users);
          setTotalPages(res.data.totalPages || 1);
          setTotalCount(res.data.totalCount || 0);
        }
      } catch (err) {
        console.error(err);
        dispatch(addToast({ message: 'Failed to fetch users list.', type: 'error' }));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    // Debounce search slightly
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [page, search, statusFilter, roleFilter, refreshKey, dispatch]);

  const handleToggleStatus = async (userId: string) => {
    if (userId === currentAdmin?.id) {
      dispatch(addToast({ message: 'You cannot suspend your own account.', type: 'error' }));
      return;
    }
    
    setActionLoading(userId);
    try {
      const res = await api.post(`/admin/user/${userId}/toggle-status`);
      dispatch(addToast({ message: res.data.message || 'User status updated successfully.', type: 'success' }));
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || 'Failed to update user status.';
      dispatch(addToast({ message: msg, type: 'error' }));
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setRoleFilter('');
    setPage(1);
  };

  if (loading && refreshKey === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 font-sans">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-gray-500">Loading user accounts...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 font-sans">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-7 h-7 text-indigo-400" />
            User Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">Manage user account access, view roles, and suspend/activate accounts.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-xl">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Total Registered</p>
              <h3 className="text-xl font-bold text-white mt-0.5">{totalCount}</h3>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <UserCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Active Users</p>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {users.length > 0 ? users.filter(u => u.status === 'ACTIVE').length : 0} / {users.length} shown
              </h3>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <UserX className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase">Suspended Users</p>
              <h3 className="text-xl font-bold text-white mt-0.5">
                {users.length > 0 ? users.filter(u => u.status === 'SUSPENDED').length : 0} / {users.length} shown
              </h3>
            </div>
          </div>
        </div>

        {/* Filters UI */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by email or user ID..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>

            <div className="w-full md:w-48">
              <select
                value={roleFilter}
                onChange={e => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>

            {(search || statusFilter || roleFilter) && (
              <button
                onClick={handleResetFilters}
                className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-sm font-semibold rounded-xl transition-colors text-gray-300 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-lg overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-gray-500">Loading user accounts...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl m-6">
              <Users className="w-12 h-12 mx-auto mb-3 text-gray-700 animate-pulse" />
              <p className="text-gray-400 text-sm mb-1">No users found</p>
              <p className="text-xs text-gray-600">Try modifying your search query or filters.</p>
            </div>
          ) : (
            <div>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/50">
                      <th className="py-4 px-6">User ID</th>
                      <th className="py-4 px-6">Email</th>
                      <th className="py-4 px-6">Role</th>
                      <th className="py-4 px-6">Balance</th>
                      <th className="py-4 px-6">Deposit Rates</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6">Registered Date</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50 text-sm">
                    {users.map(u => {
                      const isSelf = u.id === currentAdmin?.id;
                      const isSuspended = u.status === 'SUSPENDED';
                      return (
                        <tr key={u.id} className="hover:bg-gray-800/10 transition-colors group">
                          <td className="py-4 px-6 font-mono text-xs text-indigo-400 font-semibold">
                            {u.userId}
                          </td>
                          <td className="py-4 px-6 font-medium text-gray-200">
                            {u.email} {isSelf && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono ml-1.5 font-semibold">You</span>}
                          </td>
                          <td className="py-4 px-6">
                            <span className={roleBadge(u.role)}>{u.role}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-semibold text-gray-200 font-mono">
                              ₹{u.balanceINR?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                            </div>
                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                              ${u.balanceUSD?.toFixed(4) || '0.0000'} USDT
                            </div>
                          </td>
                          <td className="py-4 px-6 text-xs text-gray-400 font-mono max-w-[150px] truncate">
                            {u.depositRates && u.depositRates.length > 0 
                              ? u.depositRates.map(r => `₹${r.toFixed(2)}`).join(', ') 
                              : '—'}
                          </td>
                          <td className="py-4 px-6">
                            <span className={statusBadge(u.status)}>{u.status}</span>
                          </td>
                          <td className="py-4 px-6 text-xs text-gray-500">
                            {new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setIsHistoryModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 border border-gray-700 hover:border-gray-600 transition-all shadow-sm cursor-pointer"
                              >
                                <History className="w-3.5 h-3.5" />
                                History
                              </button>
                              
                              {isSelf ? (
                                <span className="text-xs text-gray-600 flex items-center gap-1.5">
                                  <Shield className="w-3.5 h-3.5" />
                                  System Protected
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleToggleStatus(u.id)}
                                  disabled={actionLoading === u.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
                                    isSuspended
                                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50'
                                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:border-red-500/50'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                  {actionLoading === u.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                      Updating...
                                    </>
                                  ) : isSuspended ? (
                                    <>
                                      <UserCheck className="w-3.5 h-3.5" />
                                      Activate
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="w-3.5 h-3.5" />
                                      Suspend
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-gray-800">
                {users.map(u => {
                  const isSelf = u.id === currentAdmin?.id;
                  const isSuspended = u.status === 'SUSPENDED';
                  return (
                    <div key={u.id} className="p-4 space-y-4 hover:bg-gray-800/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-indigo-400 font-semibold">{u.userId}</span>
                        <div className="flex gap-2">
                          <span className={roleBadge(u.role)}>{u.role}</span>
                          <span className={statusBadge(u.status)}>{u.status}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-gray-500">Balance</p>
                          <p className="font-bold text-white text-xs font-mono mt-0.5">
                            ₹{u.balanceINR?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}
                          </p>
                          <p className="text-[9px] text-gray-500 font-mono mt-0.5">
                            ${u.balanceUSD?.toFixed(4) || '0.0000'} USDT
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500">Deposit Rates</p>
                          <p className="text-xs text-gray-300 font-mono mt-0.5 break-words">
                            {u.depositRates && u.depositRates.length > 0 
                              ? u.depositRates.map(r => `₹${r.toFixed(2)}`).join(', ') 
                              : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] text-gray-500">Email Address</p>
                        <p className="font-medium text-gray-200 break-all text-xs">
                          {u.email}
                          {isSelf && <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded font-mono ml-1.5 font-semibold">You</span>}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-3 border-t border-gray-800/30">
                        <div>
                          <p className="text-[10px] text-gray-500">Registered</p>
                          <p className="text-gray-400 mt-0.5">{new Date(u.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setIsHistoryModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-750 text-gray-300 border border-gray-700 hover:border-gray-600 transition-all shadow-sm cursor-pointer"
                          >
                            <History className="w-3.5 h-3.5" />
                            History
                          </button>

                          {isSelf ? (
                            <span className="text-xs text-gray-600 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" />
                              System Protected
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(u.id)}
                              disabled={actionLoading === u.id}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm cursor-pointer ${
                                isSuspended
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:border-emerald-500/50'
                                  : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:border-red-500/50'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {actionLoading === u.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  Updating...
                                </>
                              ) : isSuspended ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5" />
                                  Activate
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5" />
                                  Suspend
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-6 border-t border-gray-800 bg-gray-900/35">
                  <p className="text-xs text-gray-500">
                    Showing Page {page} of {totalPages} ({totalCount} users total)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                      className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={page === totalPages}
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

        {/* User Transaction History Modal */}
        <UserTransactionHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setSelectedUser(null);
          }}
          user={selectedUser}
        />
      </div>
  );
}
