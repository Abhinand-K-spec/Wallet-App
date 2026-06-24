'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '@/api/axios';
import { createClient } from '@/utils/supabase/client';

interface ExchangeRateContextType {
  exchangeRate: number;
  rateLoading: boolean;
  refreshRate: () => Promise<void>;
}

const ExchangeRateContext = createContext<ExchangeRateContextType | undefined>(undefined);

export function ExchangeRateProvider({ children }: { children: React.ReactNode }) {
  const [exchangeRate, setExchangeRate] = useState<number>(83.50);
  const [rateLoading, setRateLoading] = useState<boolean>(true);

  const fetchRate = async () => {
    try {
      const res = await api.get('/user/rate');
      if (res.data && typeof res.data.rate === 'number') {
        setExchangeRate(res.data.rate);
      }
    } catch (err) {
      console.warn('Failed to fetch initial exchange rate:', err);
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    // 1. Get initial exchange rate
    fetchRate();

    // 2. Setup Supabase Realtime channel
    const supabase = createClient();
    const channel = supabase
      .channel('public:system_settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings',
          filter: 'key=eq.USD_INR_RATE',
        },
        (payload: any) => {
          console.log('Real-time rate update received:', payload);
          if (payload.new && payload.new.value) {
            const newRate = parseFloat(payload.new.value);
            if (!isNaN(newRate)) {
              setExchangeRate(newRate);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <ExchangeRateContext.Provider value={{ exchangeRate, rateLoading, refreshRate: fetchRate }}>
      {children}
    </ExchangeRateContext.Provider>
  );
}

export function useExchangeRate() {
  const context = useContext(ExchangeRateContext);
  if (context === undefined) {
    throw new Error('useExchangeRate must be used within an ExchangeRateProvider');
  }
  return context;
}
