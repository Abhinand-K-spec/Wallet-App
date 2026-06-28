import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { simulateFIFO } from '@/utils/balance';

async function verifyAdmin(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }
  return { user, profile };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const role = searchParams.get('role');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Fetch active exchange rate
    const { data: rateSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_INR_RATE')
      .maybeSingle();
    const rate = rateSetting ? parseFloat(rateSetting.value) : 83.50;

    // Build Supabase dynamic query
    let query = supabase.from('profiles').select('*', { count: 'exact' });

    if (role && ['USER', 'ADMIN'].includes(role)) {
      query = query.eq('role', role);
    }
    if (status && ['ACTIVE', 'SUSPENDED'].includes(status)) {
      query = query.eq('status', status);
    }
    if (search) {
      query = query.or(`email.ilike.%${search}%,user_id.ilike.%${search}%`);
    }
    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }

    // Apply ordering & pagination
    const { data: users, count, error } = await query
      .order('created_at', { ascending: false })
      .range(skip, skip + limitNum - 1);

    if (error) {
      console.error('Fetch users query error:', error);
      return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
    }

    const totalCount = count || 0;

    // Fetch deposits and withdrawals for these users
    const userIds = (users || []).map((u: any) => u.id);
    let depositsData: any[] = [];
    let withdrawalsData: any[] = [];

    if (userIds.length > 0) {
      const { data: dep } = await supabase
        .from('wallet_deposits')
        .select('user_id, amount_usd, equivalent_inr, admin_entered_rate, status')
        .in('user_id', userIds);
      if (dep) depositsData = dep;

      const { data: wd } = await supabase
        .from('withdrawals')
        .select('user_id, amount_usd, amount_inr, status')
        .in('user_id', userIds);
      if (wd) withdrawalsData = wd;
    }

    // Convert keys to camelCase to match expectations
    const mappedUsers = (users || []).map((u: any) => {
      const userDeposits = depositsData.filter((d: any) => d.user_id === u.id);
      const userWithdrawals = withdrawalsData.filter((w: any) => w.user_id === u.id);

      const approvedDeposits = userDeposits.filter((d: any) => ['APPROVED', 'SUCCESS'].includes(d.status));
      const approvedWithdrawals = userWithdrawals.filter((w: any) => ['APPROVED', 'PAID'].includes(w.status));

      const { availableUSD: balanceUSD, availableINR: balanceINR } = simulateFIFO(userDeposits, userWithdrawals, rate);

      const depositRates = Array.from(new Set(
        approvedDeposits
          .map((d: any) => d.admin_entered_rate)
          .filter((rate: any) => rate !== null && rate !== undefined)
      )) as number[];

      return {
        id: u.id,
        userId: u.user_id,
        email: u.email,
        role: u.role,
        status: u.status,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        balanceUSD,
        balanceINR,
        depositRates,
      };
    });

    return NextResponse.json({
      users: mappedUsers,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum)
    });
  } catch (error: any) {
    console.error('Admin users get error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
