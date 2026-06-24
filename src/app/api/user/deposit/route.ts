import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { verifyOnChainUSDT } from '@/utils/blockchain';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { txHash, amountUSD } = body;

    if (!txHash || !amountUSD) {
      return NextResponse.json({ error: 'Transaction hash and amount are required' }, { status: 400 });
    }

    // Check if transaction hash already submitted
    const { data: existingDeposit } = await supabase
      .from('wallet_deposits')
      .select('id')
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (existingDeposit) {
      return NextResponse.json({ error: 'Transaction hash already submitted' }, { status: 400 });
    }

    // Live blockchain verification
    const adminWallet = process.env.ADMIN_WALLET_ADDRESS || '0x1234567890abcdef1234567890abcdef12345678';
    const onChainResult = await verifyOnChainUSDT(txHash, adminWallet);

    if (!onChainResult.success) {
      return NextResponse.json({ error: `Blockchain verification failed: ${onChainResult.message}` }, { status: 400 });
    }

    // Fetch USD_INR_RATE from system_settings
    const { data: rateSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'USD_INR_RATE')
      .maybeSingle();

    const rate = rateSetting ? parseFloat(rateSetting.value) : 83.50;
    const equivalentINR = onChainResult.amountUSD * rate;

    // Save verified deposit log
    const { data: deposit, error: depositError } = await supabase
      .from('wallet_deposits')
      .insert({
        user_id: user.id,
        tx_hash: txHash,
        amount_usd: onChainResult.amountUSD,
        equivalent_inr: equivalentINR,
        admin_entered_rate: rate,
        wallet_address: onChainResult.fromAddress,
        status: 'PENDING',
        on_chain_verified: true,
        on_chain_network: onChainResult.network,
        on_chain_from: onChainResult.fromAddress,
        on_chain_to: onChainResult.toAddress,
        on_chain_amount: onChainResult.amountUSD,
        on_chain_tx_hash: onChainResult.txHash || txHash,
      })
      .select()
      .single();

    if (depositError || !deposit) {
      console.error('Insert deposit error:', depositError);
      return NextResponse.json({ error: 'Failed to record deposit' }, { status: 500 });
    }

    // Format response to camelCase
    return NextResponse.json({
      message: 'Deposit submitted and blockchain verified successfully',
      deposit: {
        id: deposit.id,
        userId: deposit.user_id,
        txHash: deposit.tx_hash,
        amountUSD: deposit.amount_usd,
        equivalentINR: deposit.equivalent_inr,
        adminEnteredRate: deposit.admin_entered_rate,
        status: deposit.status,
        onChainVerified: deposit.on_chain_verified
      }
    }, { status: 201 });
  } catch (error: any) {
    console.error('Submit deposit API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
