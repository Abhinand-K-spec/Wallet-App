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

export async function POST(
  request: Request,
  context: { params: Promise<{ proofId: string }> }
) {
  try {
    const { proofId } = await context.params;
    const body = await request.json();
    const {
      approvedAmount,
      approvedCurrency,
      approvedReference,
      approvedBank,
      approvedSender,
      approvedReceiver,
      approvedAccount,
      approvedWallet,
      approvedDate,
      approvedTime,
      approvedStatus
    } = body;

    // 1. Validation
    if (!approvedAmount || !approvedReference || !approvedCurrency) {
      return NextResponse.json({ error: 'Amount, Currency, and Reference/UTR are required for approval.' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // 2. Fetch the payment proof details
    const { data: proof, error: fetchErr } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('id', proofId)
      .maybeSingle();

    if (fetchErr || !proof) {
      return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
    }

    // 3. Update the payment proof to APPROVED state with final fields
    const { data: updatedProof, error: updateErr } = await supabase
      .from('payment_proofs')
      .update({
        approved_amount: parseFloat(approvedAmount),
        approved_currency: approvedCurrency,
        approved_reference: approvedReference,
        approved_bank: approvedBank,
        approved_sender: approvedSender,
        approved_receiver: approvedReceiver,
        approved_account: approvedAccount,
        approved_wallet: approvedWallet,
        approved_date: approvedDate,
        approved_time: approvedTime,
        approved_status: approvedStatus || 'APPROVED',
        approved_by: adminCheck.user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', proofId)
      .select()
      .single();

    if (updateErr || !updatedProof) {
      console.error('Failed to finalize payment proof in DB:', updateErr);
      return NextResponse.json({ error: 'Failed to finalize payment proof record' }, { status: 500 });
    }

    // 4. Update the associated payment request (Deposit or Withdrawal)
    // Check deposits first
    const { data: deposit } = await supabase
      .from('wallet_deposits')
      .select('*')
      .eq('id', proof.payment_request_id)
      .maybeSingle();

    if (deposit) {
      if (deposit.status === 'PENDING') {
        const { data: rateSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'USD_INR_RATE')
          .maybeSingle();

        const globalRate = rateSetting ? parseFloat(rateSetting.value) : 83.50;
        const rateFloat = deposit.admin_entered_rate || globalRate;
        const equivalentINR = deposit.amount_usd * rateFloat;

        // Approve deposit
        await supabase
          .from('wallet_deposits')
          .update({
            status: 'APPROVED',
            admin_entered_rate: rateFloat,
            equivalent_inr: equivalentINR,
            updated_at: new Date().toISOString()
          })
          .eq('id', deposit.id);

        // Insert into ledger transactions
        await supabase
          .from('transactions')
          .insert({
            user_id: deposit.user_id,
            transaction_type: 'DEPOSIT',
            amount_usd: deposit.amount_usd,
            amount_inr: equivalentINR,
            reference: deposit.id,
            status: 'COMPLETED'
          });

        // Log deposit admin action
        await supabase
          .from('admin_actions')
          .insert({
            admin_id: adminCheck.user.id,
            action: 'APPROVED_DEPOSIT',
            target_id: deposit.id
          });
      }
    } else {
      // Check withdrawals
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', proof.payment_request_id)
        .maybeSingle();

      if (withdrawal) {
        // Payout marked as PAID
        await supabase
          .from('withdrawals')
          .update({
            status: 'PAID',
            approved_by: adminCheck.user.id,
            utr: approvedReference,
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawal.id);

        // Insert into ledger transactions
        await supabase
          .from('transactions')
          .insert({
            user_id: withdrawal.user_id,
            transaction_type: 'WITHDRAWAL',
            amount_usd: withdrawal.amount_usd,
            amount_inr: withdrawal.amount_inr,
            reference: withdrawal.id,
            status: 'COMPLETED'
          });

        // Log withdrawal admin action
        await supabase
          .from('admin_actions')
          .insert({
            admin_id: adminCheck.user.id,
            action: 'PAID_WITHDRAWAL',
            target_id: withdrawal.id
          });
      }
    }

    // 5. Log Audit Log
    const { error: auditErr } = await supabase
      .from('payment_proof_audits')
      .insert({
        payment_proof_id: proofId,
        admin_id: adminCheck.user.id,
        action: 'APPROVAL_COMPLETED',
        details: { approvedAmount: parseFloat(approvedAmount), approvedReference }
      });

    if (auditErr) {
      console.error('Failed to log audit:', auditErr);
    }

    return NextResponse.json({
      message: 'Payment proof approved and request finalized successfully',
      proof: updatedProof
    });
  } catch (error: any) {
    console.error('Payment proof approval error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
