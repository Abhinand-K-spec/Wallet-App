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
    const { amount, currency } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid payment amount greater than 0 is required.' }, { status: 400 });
    }

    if (!currency || !['USDT', 'INR'].includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency. Must be USDT or INR.' }, { status: 400 });
    }

    const numAmount = Number(amount);

    // Fetch USD_INR_RATE
    const { data: rateSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_INR_RATE')
      .maybeSingle();

    const rate = rateSetting ? parseFloat(rateSetting.value) : 83.50;

    let amountUSD = 0;
    let equivalentINR = 0;

    if (currency === 'INR') {
      amountUSD = Number((numAmount / rate).toFixed(2));
      equivalentINR = numAmount;
    } else {
      amountUSD = numAmount;
      equivalentINR = Number((numAmount * rate).toFixed(2));
    }

    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    const qrPayload = `https://link.trustwallet.com/send?asset=c195_tTR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&address=${adminWalletAddress}&amount=${amountUSD}`;

    // Create pending deposit
    const { data: deposit, error: insertErr } = await supabase
      .from('wallet_deposits')
      .insert({
        user_id: user.id,
        amount_usd: amountUSD,
        equivalent_inr: equivalentINR,
        admin_entered_rate: rate,
        status: 'PENDING',
        order_id: orderId,
        network: 'TRC20',
        currency,
        expires_at: expiresAt,
        qr_payload: qrPayload,
      })
      .select()
      .single();

    if (insertErr || !deposit) {
      console.error('Insert payment order error:', insertErr);
      return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: deposit.order_id,
      walletAddress: adminWalletAddress,
      amount: amountUSD.toFixed(2),
      network: 'TRC20',
      qrPayload: deposit.qr_payload,
      expiresAt: deposit.expires_at,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Create payment API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
