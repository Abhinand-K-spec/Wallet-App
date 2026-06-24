import axios from 'axios';
import { createClient } from '@/utils/supabase/client';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

export default api;
