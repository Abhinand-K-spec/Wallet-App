'use client';

import React, { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import type { RootState } from '../store/store';
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, History, LogOut, Wallet, Users, Menu, X, Send } from 'lucide-react';
import api from '../api/axios';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSelector((state: RootState) => state.auth);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    <div className="h-screen bg-gray-950 flex text-gray-100 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none hidden md:block" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-500/5 rounded-full blur-[120px] pointer-events-none hidden md:block" />

      {/* Sidebar (Desktop) */}
      <aside className="w-64 bg-gray-900/60 backdrop-blur-xl border-r border-gray-800/80 flex flex-col hidden md:flex shrink-0 relative z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-800/80">
          <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/20 border border-indigo-400/20 mr-2.5">
            <Wallet className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-xl font-black bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">GetPay</span>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.path}
                className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  isActive 
                    ? 'bg-indigo-600/10 text-indigo-400 shadow-inner border-l-2 border-indigo-500' 
                    : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border-l-2 border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 transition-colors duration-300 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
                {item.name}
              </Link>
            )
          })}
          <a
            href="https://t.me/+NO_KPQL5h8lkNmZl"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border-l-2 border-transparent transition-all duration-300 cursor-pointer"
          >
            <Send className="w-5 h-5 mr-3 text-gray-500" />
            Customer Care
          </a>
        </div>

        <div className="p-4 border-t border-gray-800/80 bg-gray-950/20">
          <div className="mb-4 px-3 py-2 bg-gray-950/40 rounded-xl border border-gray-800/50">
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Account</p>
              {user?.role === 'ADMIN' && (
                <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded uppercase font-extrabold tracking-wider">Admin</span>
              )}
            </div>
            <p className="text-sm font-semibold text-gray-200 mt-1 truncate">{user?.email}</p>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{user?.userId}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
          >
            <LogOut className="w-5 h-5 mr-3 text-red-500" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/75 animate-fade-in" onClick={() => setIsMobileMenuOpen(false)} />
          
          {/* Drawer Menu */}
          <div className="relative w-full max-w-[280px] bg-gray-900 border-r border-gray-850 flex flex-col p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-800">
              <div className="flex items-center">
                <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg mr-2">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-black bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">GetPay</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-white bg-gray-800/50 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
                      isActive 
                        ? 'bg-indigo-600/10 text-indigo-400 border-l-2 border-indigo-500' 
                        : 'text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border-l-2 border-transparent'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-indigo-400' : 'text-gray-500'}`} />
                    {item.name}
                  </Link>
                )
              })}
              <a
                href="https://t.me/+NO_KPQL5h8lkNmZl"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-gray-400 hover:bg-gray-800/40 hover:text-gray-200 border-l-2 border-transparent transition-all duration-300 cursor-pointer"
              >
                <Send className="w-5 h-5 mr-3 text-gray-500" />
                Customer Care
              </a>
            </div>

            <div className="border-t border-gray-800 pt-6">
              <div className="mb-4 px-3 py-2 bg-gray-950/40 rounded-xl border border-gray-800/50">
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Account</p>
                  {user?.role === 'ADMIN' && (
                    <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1 rounded uppercase font-extrabold tracking-wider">Admin</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-200 mt-1 truncate">{user?.email}</p>
                <p className="text-[11px] text-gray-500 font-mono mt-0.5">{user?.userId}</p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-all duration-300 cursor-pointer"
              >
                <LogOut className="w-5 h-5 mr-3 text-red-500" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-20">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-gray-800/80 bg-gray-900/95 flex items-center justify-between px-4 z-40 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/50 mr-1 cursor-pointer">
              <Menu className="w-6 h-6" />
            </button>
            <div className="bg-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg border border-indigo-400/20">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">GetPay</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer transition-all">
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
