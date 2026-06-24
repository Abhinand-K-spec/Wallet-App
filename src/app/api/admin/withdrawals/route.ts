import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

export async function GET() {
  try {
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { data: withdrawals, error } = await supabase
      .from('withdrawals')
      .select(`
        *,
        user:profiles!withdrawals_user_id_fkey (
          email,
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch withdrawals error:', error);
      return NextResponse.json({ error: 'Failed to retrieve withdrawals' }, { status: 500 });
    }

    const mappedWithdrawals = (withdrawals || []).map((w: any) => ({
      id: w.id,
      userId: w.user_id,
      amountUSD: w.amount_usd,
      amountINR: w.amount_inr,
      method: w.method,
      accountHolder: w.account_holder,
      accountNumber: w.account_number,
      ifsc: w.ifsc,
      walletAddress: w.wallet_address,
      status: w.status,
      approvedBy: w.approved_by,
      utr: w.utr,
      downloaded: w.downloaded,
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      user: w.user ? {
        email: w.user.email,
        userId: w.user.user_id,
      } : null,
    }));

    return NextResponse.json(mappedWithdrawals);
  } catch (error: any) {
    console.error('Admin withdrawals GET error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
