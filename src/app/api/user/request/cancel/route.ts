import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id || !['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
      return NextResponse.json({ error: 'Valid type (DEPOSIT or WITHDRAWAL) and transaction ID are required' }, { status: 400 });
    }

    if (type === 'DEPOSIT') {
      // Fetch deposit row
      const { data: deposit, error: fetchErr } = await supabase
        .from('wallet_deposits')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !deposit) {
        return NextResponse.json({ error: 'Deposit request not found' }, { status: 404 });
      }

      if (deposit.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (deposit.status !== 'PENDING') {
        return NextResponse.json({ error: 'Only pending deposit requests can be cancelled' }, { status: 400 });
      }

      // Update status to CANCEL_REQUESTED
      const { error: updateErr } = await supabase
        .from('wallet_deposits')
        .update({ status: 'CANCEL_REQUESTED', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) {
        console.error('Failed to update deposit status to CANCEL_REQUESTED:', updateErr);
        return NextResponse.json({ error: 'Failed to update deposit cancellation request' }, { status: 500 });
      }

    } else {
      // Fetch withdrawal row
      const { data: withdrawal, error: fetchErr } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !withdrawal) {
        return NextResponse.json({ error: 'Withdrawal request not found' }, { status: 404 });
      }

      if (withdrawal.user_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      if (withdrawal.status !== 'PENDING') {
        return NextResponse.json({ error: 'Only pending withdrawal requests can be cancelled' }, { status: 400 });
      }

      // Update status to CANCEL_REQUESTED
      const { error: updateErr } = await supabase
        .from('withdrawals')
        .update({ status: 'CANCEL_REQUESTED', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) {
        console.error('Failed to update withdrawal status to CANCEL_REQUESTED:', updateErr);
        return NextResponse.json({ error: 'Failed to update withdrawal cancellation request' }, { status: 500 });
      }
    }

    return NextResponse.json({
      message: 'Cancellation request submitted successfully to admin approval.',
      success: true
    }, { status: 200 });

  } catch (error: any) {
    console.error('Request cancellation error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
