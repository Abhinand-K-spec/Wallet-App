import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check if the user is authenticated (users have read-only access)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get('paymentRequestId');

    if (!paymentRequestId) {
      return NextResponse.json({ error: 'paymentRequestId is required' }, { status: 400 });
    }

    const { data: proof, error: fetchErr } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('payment_request_id', paymentRequestId)
      .maybeSingle();

    if (fetchErr || !proof) {
      // Try to fetch withdrawal details
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', paymentRequestId)
        .maybeSingle();

      if (withdrawal) {
        return NextResponse.json({
          hasProof: false,
          withdrawal: {
            id: withdrawal.id,
            utr: withdrawal.utr,
            amountUSD: withdrawal.amount_usd,
            amountINR: withdrawal.amount_inr,
            method: withdrawal.method,
            status: withdrawal.status,
            updatedAt: withdrawal.updated_at
          }
        });
      }

      // Try to fetch deposit details
      const { data: deposit } = await supabase
        .from('wallet_deposits')
        .select('*')
        .eq('id', paymentRequestId)
        .maybeSingle();

      if (deposit) {
        return NextResponse.json({
          hasProof: false,
          deposit: {
            id: deposit.id,
            utr: deposit.tx_hash,
            amountUSD: deposit.amount_usd,
            amountINR: deposit.equivalent_inr,
            status: deposit.status,
            updatedAt: deposit.updated_at
          }
        });
      }

      return NextResponse.json({ hasProof: false });
    }

    // Only return admin approved fields, strictly never return raw OCR or confidence values!
    return NextResponse.json({
      hasProof: true,
      id: proof.id,
      paymentRequestId: proof.payment_request_id,
      originalFileUrl: proof.original_file_url,
      amount: proof.approved_amount,
      currency: proof.approved_currency,
      reference: proof.approved_reference,
      bank: proof.approved_bank,
      sender: proof.approved_sender,
      receiver: proof.approved_receiver,
      account: proof.approved_account,
      wallet: proof.approved_wallet,
      date: proof.approved_date,
      time: proof.approved_time,
      status: proof.approved_status,
      approvedAt: proof.approved_at,
      createdAt: proof.created_at
    });
  } catch (error: any) {
    console.error('User payment proof GET error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
