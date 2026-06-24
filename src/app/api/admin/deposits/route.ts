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

    const { data: deposits, error } = await supabase
      .from('wallet_deposits')
      .select(`
        *,
        user:profiles (
          email,
          user_id
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch deposits error:', error);
      return NextResponse.json({ error: 'Failed to retrieve deposits' }, { status: 500 });
    }

    const mappedDeposits = (deposits || []).map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      walletAddress: d.wallet_address,
      txHash: d.tx_hash,
      amountUSD: d.amount_usd,
      equivalentINR: d.equivalent_inr,
      adminEnteredRate: d.admin_entered_rate,
      status: d.status,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      onChainVerified: d.on_chain_verified,
      onChainNetwork: d.on_chain_network,
      onChainFrom: d.on_chain_from,
      onChainTo: d.on_chain_to,
      onChainAmount: d.on_chain_amount,
      onChainTxHash: d.on_chain_tx_hash,
      orderId: d.order_id,
      network: d.network,
      currency: d.currency,
      expiresAt: d.expires_at,
      qrPayload: d.qr_payload,
      user: d.user ? {
        email: d.user.email,
        userId: d.user.user_id,
      } : null,
    }));

    return NextResponse.json(mappedDeposits);
  } catch (error: any) {
    console.error('Admin deposits GET error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
