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
  context: { params: Promise<{ withdrawalId: string }> }
) {
  try {
    const { withdrawalId } = await context.params;
    const body = await request.json();
    const { action, utr } = body; // action: 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED' | 'REJECT_CANCEL'

    if (!action || !['APPROVED', 'REJECTED', 'PAID', 'CANCELLED', 'REJECT_CANCEL'].includes(action)) {
      return NextResponse.json({ error: 'Valid action APPROVED, REJECTED, PAID, CANCELLED or REJECT_CANCEL is required' }, { status: 400 });
    }

    if (action === 'PAID' && !utr) {
      return NextResponse.json({ error: 'UTR number required to mark as PAID' }, { status: 400 });
    }

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Fetch withdrawal details
    const { data: withdrawal, error: fetchErr } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .maybeSingle();

    if (fetchErr || !withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    // Map action to database status
    const targetStatus = action === 'REJECT_CANCEL' ? 'PENDING' : action;

    // Update withdrawal record
    const { data: updatedWithdrawal, error: updateErr } = await supabase
      .from('withdrawals')
      .update({
        status: targetStatus,
        approved_by: adminCheck.user.id,
        utr: action === 'PAID' ? utr : withdrawal.utr,
        updated_at: new Date().toISOString()
      })
      .eq('id', withdrawalId)
      .select()
      .single();

    if (updateErr || !updatedWithdrawal) {
      console.error('Update withdrawal error:', updateErr);
      return NextResponse.json({ error: 'Failed to update withdrawal' }, { status: 500 });
    }

    // If marked as PAID, create transaction ledger record
    if (action === 'PAID') {
      const { error: ledgerErr } = await supabase
        .from('transactions')
        .insert({
          user_id: withdrawal.user_id,
          transaction_type: 'WITHDRAWAL',
          amount_usd: withdrawal.amount_usd,
          amount_inr: withdrawal.amount_inr,
          reference: withdrawal.id,
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
        action: `${action}_WITHDRAWAL`,
        target_id: withdrawal.id
      });

    return NextResponse.json({
      message: `Withdrawal ${action.toLowerCase()} successfully`,
      withdrawal: {
        id: updatedWithdrawal.id,
        userId: updatedWithdrawal.user_id,
        status: updatedWithdrawal.status,
        utr: updatedWithdrawal.utr,
      }
    });
  } catch (error: any) {
    console.error('Manage withdrawal error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
