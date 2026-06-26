import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { processOcr } from '@/utils/ocrService';
import path from 'path';

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
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // 1. Fetch the payment proof details
    const { data: proof, error: fetchErr } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('id', proofId)
      .maybeSingle();

    if (fetchErr || !proof) {
      return NextResponse.json({ error: 'Payment proof not found' }, { status: 404 });
    }

    // 2. Fetch the parent payment request to supply matching OCR mock values
    let amount = 500;
    let currency = 'USDT';
    let type: 'DEPOSIT' | 'WITHDRAWAL' = 'DEPOSIT';
    let wallet = undefined;
    let account = undefined;
    let reference = undefined;

    // Check deposits first
    const { data: deposit } = await supabase
      .from('wallet_deposits')
      .select('*')
      .eq('id', proof.payment_request_id)
      .maybeSingle();

    if (deposit) {
      amount = deposit.amount_usd;
      currency = deposit.currency || 'USDT';
      type = 'DEPOSIT';
      reference = deposit.tx_hash;
    } else {
      // Check withdrawals
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('id', proof.payment_request_id)
        .maybeSingle();

      if (withdrawal) {
        amount = withdrawal.amount_inr || withdrawal.amount_usd;
        currency = withdrawal.method === 'USDT' ? 'USDT' : 'INR';
        type = 'WITHDRAWAL';
        wallet = withdrawal.wallet_address;
        account = withdrawal.account_number;
        reference = withdrawal.utr;
      }
    }

    // 3. Trigger simulated OCR
    const ocrResult = await processOcr(
      path.join(process.cwd(), 'public', proof.original_file_url),
      path.basename(proof.original_file_url),
      { amount, currency, type, wallet, account, reference }
    );

    // 4. Update the DB record with OCR values (confidence, text, fields)
    const { data: updatedProof, error: updateErr } = await supabase
      .from('payment_proofs')
      .update({
        ocr_raw_text: ocrResult.rawText,
        ocr_amount: ocrResult.amount,
        ocr_currency: ocrResult.currency,
        ocr_reference: ocrResult.reference,
        ocr_bank: ocrResult.bank,
        ocr_sender: ocrResult.sender,
        ocr_receiver: ocrResult.receiver,
        ocr_account: ocrResult.account,
        ocr_wallet: ocrResult.wallet,
        ocr_date: ocrResult.date,
        ocr_time: ocrResult.time,
        ocr_status: ocrResult.status,
        ocr_confidence: ocrResult.confidence
      })
      .eq('id', proofId)
      .select()
      .single();

    if (updateErr || !updatedProof) {
      console.error('Failed to update proof with OCR data:', updateErr);
      return NextResponse.json({ error: 'Failed to save OCR results to database' }, { status: 500 });
    }

    // 5. Log Audit Log
    const { error: auditErr } = await supabase
      .from('payment_proof_audits')
      .insert({
        payment_proof_id: proofId,
        admin_id: adminCheck.user.id,
        action: 'OCR_COMPLETED',
        details: { confidence: ocrResult.confidence }
      });

    if (auditErr) {
      console.error('Failed to log audit:', auditErr);
    }

    return NextResponse.json({
      message: 'OCR completed successfully',
      proof: updatedProof
    });
  } catch (error: any) {
    console.error('Payment proof OCR error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
