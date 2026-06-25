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
  context: { params: Promise<{ depositId: string }> }
) {
  try {
    const { depositId } = await context.params;
    const body = await request.json();
    const { action, adminEnteredRate } = body; // action: 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REJECT_CANCEL'

    if (!action || !['APPROVED', 'REJECTED', 'CANCELLED', 'REJECT_CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'Valid action APPROVED, REJECTED, CANCELLED or REJECT_CANCEL is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Fetch deposit details
    const { data: deposit, error: fetchErr } = await supabase
      .from('wallet_deposits')
      .select('*')
      .eq('id', depositId)
      .maybeSingle();

    if (fetchErr || !deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    if (!['PENDING', 'CANCEL_REQUESTED'].includes(deposit.status)) {
      return NextResponse.json({ error: 'Deposit already processed' }, { status: 400 });
    }

    // Fetch active global rate from system_settings
    const { data: rateSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_INR_RATE')
      .maybeSingle();

    const globalRate = rateSetting ? parseFloat(rateSetting.value) : 83.50;
    const rateFloat = deposit.admin_entered_rate || globalRate;
    const equivalentINR = (action === 'APPROVED') ? deposit.amount_usd * rateFloat : null;

    const targetStatus = action === 'REJECT_CANCEL' ? 'PENDING' : action;
    const isApproved = action === 'APPROVED';
    const isCancelled = action === 'CANCELLED';

    // Update deposit status
    const { data: updatedDeposit, error: updateErr } = await supabase
      .from('wallet_deposits')
      .update({
        status: targetStatus,
        admin_entered_rate: isApproved ? rateFloat : (isCancelled ? null : deposit.admin_entered_rate),
        equivalent_inr: isApproved ? equivalentINR : (isCancelled ? null : deposit.equivalent_inr),
        updated_at: new Date().toISOString()
      })
      .eq('id', depositId)
      .select()
      .single();

    if (updateErr || !updatedDeposit) {
      console.error('Update deposit status error:', updateErr);
      return NextResponse.json({ error: 'Failed to update deposit' }, { status: 500 });
    }

    // If approved, create ledger transaction
    if (action === 'APPROVED') {
      const { error: ledgerErr } = await supabase
        .from('transactions')
        .insert({
          user_id: deposit.user_id,
          transaction_type: 'DEPOSIT',
          amount_usd: deposit.amount_usd,
          amount_inr: equivalentINR,
          reference: deposit.id,
          status: 'COMPLETED'
        });

      if (ledgerErr) {
        console.error('Create ledger transaction error:', ledgerErr);
      }
    }

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminCheck.user.id,
        action: `${action}_DEPOSIT`,
        target_id: deposit.id
      });

    return NextResponse.json({
      message: `Deposit ${action.toLowerCase()} successfully`,
      deposit: {
        id: updatedDeposit.id,
        userId: updatedDeposit.user_id,
        status: updatedDeposit.status,
        adminEnteredRate: updatedDeposit.admin_entered_rate,
        equivalentINR: updatedDeposit.equivalent_inr
      }
    });
  } catch (error: any) {
    console.error('Verify deposit action error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
