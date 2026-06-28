import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function mapDeposit(d: any) {
  return {
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
  };
}

function mapWithdrawal(w: any) {
  return {
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
    utr: w.utr,
    createdAt: w.created_at,
    updatedAt: w.updated_at
  };
}

function mapTransaction(t: any) {
  return {
    id: t.id,
    userId: t.user_id,
    transactionType: t.transaction_type,
    amountUSD: t.amount_usd,
    amountINR: t.amount_inr,
    reference: t.reference,
    status: t.status,
    createdAt: t.created_at
  };
}

export async function GET() {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [transactionsRes, depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('wallet_deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      transactions: (transactionsRes.data || []).map(mapTransaction),
      deposits: (depositsRes.data || []).map(mapDeposit),
      withdrawals: (withdrawalsRes.data || []).map(mapWithdrawal),
    });
  } catch (error: any) {
    console.error('Transactions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
