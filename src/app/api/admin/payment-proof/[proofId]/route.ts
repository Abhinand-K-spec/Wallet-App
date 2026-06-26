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

export async function GET(
  request: Request,
  context: { params: Promise<{ proofId: string }> }
) {
  try {
    const { proofId } = await context.params;
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { data: proof, error: fetchErr } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('id', proofId)
      .maybeSingle();

    if (fetchErr || !proof) {
      return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
    }

    return NextResponse.json(proof);
  } catch (error: any) {
    console.error('Payment proof GET error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ proofId: string }> }
) {
  try {
    const { proofId } = await context.params;
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

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

    const { data: updatedProof, error: updateErr } = await supabase
      .from('payment_proofs')
      .update({
        approved_amount: approvedAmount ? parseFloat(approvedAmount) : null,
        approved_currency: approvedCurrency,
        approved_reference: approvedReference,
        approved_bank: approvedBank,
        approved_sender: approvedSender,
        approved_receiver: approvedReceiver,
        approved_account: approvedAccount,
        approved_wallet: approvedWallet,
        approved_date: approvedDate,
        approved_time: approvedTime,
        approved_status: approvedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', proofId)
      .select()
      .single();

    if (updateErr || !updatedProof) {
      console.error('Failed to update proof with approved data:', updateErr);
      return NextResponse.json({ error: 'Failed to update payment proof record' }, { status: 500 });
    }

    // Log Audit Log
    const { error: auditErr } = await supabase
      .from('payment_proof_audits')
      .insert({
        payment_proof_id: proofId,
        admin_id: adminCheck.user.id,
        action: 'EDITED_FIELDS',
        details: { editedFields: Object.keys(body) }
      });

    if (auditErr) {
      console.error('Failed to log audit:', auditErr);
    }

    return NextResponse.json({
      message: 'Payment proof saved as draft',
      proof: updatedProof
    });
  } catch (error: any) {
    console.error('Payment proof PUT error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
