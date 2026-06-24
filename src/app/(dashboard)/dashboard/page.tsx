'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import UserDashboard from '@/components/UserDashboard';
import AdminDashboard from '@/components/AdminDashboard';

export default function DashboardPage() {
  const { user } = useSelector((state: RootState) => state.auth);

  if (!user) return null;

  return user.role === 'ADMIN' ? <AdminDashboard /> : <UserDashboard />;
}

