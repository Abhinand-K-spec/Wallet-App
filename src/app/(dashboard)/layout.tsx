'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import Layout from '@/components/Layout';
import { ExchangeRateProvider } from '@/context/ExchangeRateContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user && pathname.startsWith('/admin') && user.role !== 'ADMIN') {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, user, router, mounted, pathname]);

  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
      </div>
    );
  }

  return (
    <ExchangeRateProvider>
      <Layout>{children}</Layout>
    </ExchangeRateProvider>
  );
}
