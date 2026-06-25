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
    const { method: reqMethod, amountUSD, amountINR, accountHolder, accountNumber, ifsc, walletAddress } = body;
    const method = reqMethod || 'BANK';

    // Fetch user's approved deposits and non-rejected withdrawals to check balance
    const [depositsRes, withdrawalsRes] = await Promise.all([
      supabase.from('wallet_deposits').select('*').eq('user_id', user.id).in('status', ['APPROVED', 'SUCCESS']),
      supabase.from('withdrawals').select('*').eq('user_id', user.id).in('status', ['PENDING', 'APPROVED', 'PAID', 'CANCEL_REQUESTED']),
    ]);

    const deposits = depositsRes.data || [];
    const withdrawals = withdrawalsRes.data || [];

    // Calculate balance in USD
    const totalDepositsUSD = deposits.reduce((acc, d) => acc + d.amount_usd, 0);
    const totalWithdrawalsUSD = withdrawals.reduce((acc, w) => {
      const fee = w.method === 'USDT' ? 0.5 : 0;
      return acc + w.amount_usd + fee;
    }, 0);
    const availableBalanceUSD = Math.max(0, totalDepositsUSD - totalWithdrawalsUSD);

    // Fetch active exchange rate
    const { data: rateSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_INR_RATE')
      .maybeSingle();
    const rate = rateSetting ? parseFloat(rateSetting.value) : 83.50;

    // Available balance in INR calculated based on locked historical rates
    const totalDepositsINR = deposits.reduce((acc, d) => acc + (d.equivalent_inr || 0), 0);
    const totalWithdrawalsINR = withdrawals.reduce((acc, w) => {
      const rateAtWithdrawal = w.amount_usd > 0 ? (w.amount_inr / w.amount_usd) : rate;
      const feeINR = w.method === 'USDT' ? 0.5 * rateAtWithdrawal : 0;
      return acc + w.amount_inr + feeINR;
    }, 0);
    const availableBalanceINR = Math.max(0, totalDepositsINR - totalWithdrawalsINR);

    let finalAmountUSD = 0;
    let finalAmountINR = 0;

    if (method === 'BANK') {
      if (!amountINR || isNaN(parseFloat(amountINR)) || parseFloat(amountINR) <= 0) {
        return NextResponse.json({ error: 'Withdrawal amount in INR must be greater than 0' }, { status: 400 });
      }
      if (!accountHolder || !accountNumber || !ifsc) {
        return NextResponse.json({ error: 'Account holder, account number, and IFSC are required for bank withdrawals' }, { status: 400 });
      }
      if (!/^[a-zA-Z\s.]{3,60}$/.test(accountHolder.trim())) {
        return NextResponse.json({ error: 'Invalid account holder name. Minimum 3 characters, alphabets and spaces only' }, { status: 400 });
      }
      if (!/^\d{9,18}$/.test(accountNumber)) {
        return NextResponse.json({ error: 'Invalid bank account number. Must be between 9 and 18 digits' }, { status: 400 });
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase())) {
        return NextResponse.json({ error: 'Invalid IFSC code format (e.g. HDFC0001234)' }, { status: 400 });
      }

      finalAmountINR = parseFloat(amountINR);
      if (finalAmountINR > availableBalanceINR) {
        return NextResponse.json({ 
          error: `Insufficient balance. Available: ₹${availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR` 
        }, { status: 400 });
      }
      finalAmountUSD = finalAmountINR / rate;

      const { data: withdrawal, error: insertErr } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          method: 'BANK',
          amount_usd: finalAmountUSD,
          amount_inr: finalAmountINR,
          account_holder: accountHolder,
          account_number: accountNumber,
          ifsc: ifsc,
          status: 'PENDING',
        })
        .select()
        .single();

      if (insertErr || !withdrawal) {
        console.error('BANK withdrawal insert error:', insertErr);
        return NextResponse.json({ error: 'Failed to record withdrawal request' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Withdrawal requested successfully',
        withdrawal: {
          id: withdrawal.id,
          userId: withdrawal.user_id,
          method: withdrawal.method,
          amountUSD: withdrawal.amount_usd,
          amountINR: withdrawal.amount_inr,
          status: withdrawal.status
        }
      }, { status: 201 });

    } else if (method === 'USDT') {
      if (!amountUSD || isNaN(parseFloat(amountUSD)) || parseFloat(amountUSD) <= 0) {
        return NextResponse.json({ error: 'Withdrawal amount in USDT must be greater than 0' }, { status: 400 });
      }
      if (!accountHolder || !walletAddress) {
        return NextResponse.json({ error: 'Recipient name and wallet address are required for USDT withdrawals' }, { status: 400 });
      }
      if (!/^[a-zA-Z\s.]{3,60}$/.test(accountHolder.trim())) {
        return NextResponse.json({ error: 'Invalid recipient name. Minimum 3 characters, alphabets and spaces only' }, { status: 400 });
      }

      const isTrc20 = /^T[a-zA-Z0-9]{33}$/.test(walletAddress);
      if (!isTrc20) {
        return NextResponse.json({ error: 'Invalid USDT wallet address. Must be a valid TRC20 (starts with T) address' }, { status: 400 });
      }

      finalAmountUSD = parseFloat(amountUSD);
      finalAmountINR = finalAmountUSD * rate;
      if (finalAmountUSD + 0.5 > availableBalanceUSD) {
        return NextResponse.json({ 
          error: `Insufficient balance. Available: ₹${availableBalanceINR.toLocaleString('en-IN', { minimumFractionDigits: 2 })} INR (approx. $${availableBalanceUSD.toFixed(4)} USDT)` 
        }, { status: 400 });
      }

      const { data: withdrawal, error: insertErr } = await supabase
        .from('withdrawals')
        .insert({
          user_id: user.id,
          method: 'USDT',
          amount_usd: finalAmountUSD,
          amount_inr: finalAmountINR,
          account_holder: accountHolder,
          wallet_address: walletAddress,
          status: 'PENDING',
        })
        .select()
        .single();

      if (insertErr || !withdrawal) {
        console.error('USDT withdrawal insert error:', insertErr);
        return NextResponse.json({ error: 'Failed to record withdrawal request' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Withdrawal requested successfully',
        withdrawal: {
          id: withdrawal.id,
          userId: withdrawal.user_id,
          method: withdrawal.method,
          amountUSD: withdrawal.amount_usd,
          amountINR: withdrawal.amount_inr,
          status: withdrawal.status
        }
      }, { status: 201 });

    } else {
      return NextResponse.json({ error: 'Invalid withdrawal method' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Withdrawal API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
