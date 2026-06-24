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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rate } = body;

    if (rate === undefined || isNaN(parseFloat(rate)) || parseFloat(rate) <= 0) {
      return NextResponse.json({ error: 'A valid exchange rate greater than 0 is required.' }, { status: 400 });
    }

    const rateVal = parseFloat(rate).toFixed(4);

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Upsert key USD_INR_RATE
    const { error: upsertErr } = await supabase
      .from('system_settings')
      .upsert({
        key: 'USD_INR_RATE',
        value: rateVal
      }, { onConflict: 'key' });

    if (upsertErr) {
      console.error('Upsert exchange rate error:', upsertErr);
      return NextResponse.json({ error: 'Failed to update exchange rate setting.' }, { status: 500 });
    }

    // Log admin action
    await supabase
      .from('admin_actions')
      .insert({
        admin_id: adminCheck.user.id,
        action: 'UPDATE_EXCHANGE_RATE',
        target_id: 'USD_INR_RATE'
      });

    return NextResponse.json({
      message: `Exchange rate successfully updated to ₹${parseFloat(rateVal).toFixed(2)} INR`,
      rate: parseFloat(rateVal)
    });
  } catch (error: any) {
    console.error('Update exchange rate API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
