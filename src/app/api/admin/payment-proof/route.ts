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

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const paymentRequestId = searchParams.get('paymentRequestId');

    if (!paymentRequestId) {
      return NextResponse.json({ error: 'paymentRequestId is required' }, { status: 400 });
    }

    const { data: proof, error } = await supabase
      .from('payment_proofs')
      .select('*')
      .eq('payment_request_id', paymentRequestId)
      .maybeSingle();

    if (error) {
      console.error('Failed to get proof by paymentRequestId:', error);
      return NextResponse.json({ error: 'Database query error' }, { status: 500 });
    }

    if (!proof) {
      return NextResponse.json({ hasProof: false });
    }

    return NextResponse.json({
      hasProof: true,
      proof
    });
  } catch (error: any) {
    console.error('Admin payment proof query error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
