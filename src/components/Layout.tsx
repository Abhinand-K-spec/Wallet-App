'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import type { RootState } from '../store/store';
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, History, LogOut, Wallet, Users } from 'lucide-react';
import api from '../api/axios';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSelector((state: RootState) => state.auth);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.error('Logout error:', e);
    }
    dispatch(logout());
    router.push('/login');
  };

  const navItems = user?.role === 'ADMIN' ? [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Verify Deposits', path: '/admin/deposits', icon: ArrowDownToLine },
    { name: 'Manage Withdrawals', path: '/admin/withdrawals', icon: ArrowUpFromLine },
    { name: 'Manage Users', path: '/admin/users', icon: Users },
  ] : [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Deposit', path: '/deposit', icon: ArrowDownToLine },
    { name: 'Withdraw', path: '/withdraw', icon: ArrowUpFromLine },
    { name: 'History', path: '/history', icon: History },
  ];

  return (
    <div className="min-h-screen bg-gray-950 flex text-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <Wallet className="w-6 h-6 text-indigo-500 mr-2" />
          <span className="text-xl font-bold tracking-tight text-white">GetPay</span>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-600/10 text-indigo-400' 
                    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
                {item.name}
              </button>
            )
          })}
        </div>

        <div className="p-4 border-t border-gray-800">
          <div className="mb-4 px-3">
            <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">Account</p>
            <p className="text-sm font-medium text-gray-300 mt-1 truncate">{user?.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">ID: {user?.userId}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3 text-red-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-gray-800 bg-gray-900 flex items-center justify-between px-4">
          <div className="flex items-center">
            <Wallet className="w-6 h-6 text-indigo-500 mr-2" />
            <span className="text-xl font-bold text-white">GetPay</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white cursor-pointer">
            <LogOut className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
