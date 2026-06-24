import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { verifyOnChainUSDT } from '@/utils/blockchain';

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
  request: NextRequest,
  context: { params: Promise<{ depositId: string }> }
) {
  try {
    const { depositId } = await context.params;
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh');

    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    const { data: deposit, error: fetchErr } = await supabase
      .from('wallet_deposits')
      .select('*')
      .eq('id', depositId)
      .maybeSingle();

    if (fetchErr || !deposit) {
      return NextResponse.json({ error: 'Deposit not found' }, { status: 404 });
    }

    const adminWallet = process.env.ADMIN_WALLET_ADDRESS || '0x1234567890abcdef1234567890abcdef12345678';

    if (deposit.on_chain_verified && refresh !== 'true') {
      return NextResponse.json({
        depositId: deposit.id,
        txHash: deposit.tx_hash,
        submittedAmount: deposit.amount_usd,
        adminWalletAddress: adminWallet,
        onChainResult: {
          success: true,
          network: deposit.on_chain_network || 'UNKNOWN',
          fromAddress: deposit.on_chain_from || '',
          toAddress: deposit.on_chain_to || '',
          amountUSD: deposit.on_chain_amount || 0,
          txHash: deposit.on_chain_tx_hash || deposit.tx_hash,
        }
      });
    }

    if (!deposit.tx_hash) {
      return NextResponse.json({ error: 'No transaction hash submitted for this deposit.' }, { status: 400 });
    }

    // Perform live blockchain check
    const onChainResult = await verifyOnChainUSDT(deposit.tx_hash, adminWallet);

    if (onChainResult.success) {
      // Save verified results to DB
      await supabase
        .from('wallet_deposits')
        .update({
          on_chain_verified: true,
          on_chain_network: onChainResult.network,
          on_chain_from: onChainResult.fromAddress,
          on_chain_to: onChainResult.toAddress,
          on_chain_amount: onChainResult.amountUSD,
          on_chain_tx_hash: onChainResult.txHash || deposit.tx_hash,
          updated_at: new Date().toISOString()
        })
        .eq('id', depositId);
    }

    return NextResponse.json({
      depositId: deposit.id,
      txHash: deposit.tx_hash,
      submittedAmount: deposit.amount_usd,
      adminWalletAddress: adminWallet,
      onChainResult,
    });
  } catch (error: any) {
    console.error('Blockchain check API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
