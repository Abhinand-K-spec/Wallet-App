import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getOnChainTransactions } from '@/utils/blockchain';

async function findMatchingOnChainTx(supabase: any, transactions: any[], order: any, adminWalletAddress: string) {
  for (const tx of transactions) {
    // 1. Recipient address verification
    if (tx.to.toLowerCase() !== adminWalletAddress.toLowerCase()) {
      continue;
    }

    // 2. Amount match within 0.01 tolerance
    const amountDifference = Math.abs(tx.amountUSD - order.amount_usd);
    if (amountDifference > 0.01) {
      continue;
    }

    // 3. Time window check (transaction should be created around or after order creation)
    // Buffer for clock drift: 2 minutes (120,000ms)
    const orderCreatedAtMs = new Date(order.created_at).getTime();
    if (tx.timestamp < (orderCreatedAtMs - 120000)) {
      continue;
    }

    // 4. Token check (must be USDT or TRC20)
    const isUSDT = tx.tokenSymbol === 'USDT' || tx.tokenSymbol === 'TRC20';
    if (!isUSDT) {
      continue;
    }

    // 5. Unclaimed check: verify no other deposit already claimed this transaction hash
    const { data: claimed, error } = await supabase
      .from('wallet_deposits')
      .select('id')
      .eq('tx_hash', tx.hash)
      .not('id', 'eq', order.id)
      .maybeSingle();

    if (error) {
      console.error('Check claimed txHash error:', error);
      continue;
    }

    if (!claimed) {
      return tx; // Found a match!
    }
  }

  return null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const supabase = await createClient();

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: order, error: fetchErr } = await supabase
      .from('wallet_deposits')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (fetchErr || !order) {
      return NextResponse.json({ error: 'Payment order not found.' }, { status: 404 });
    }

    // If already verified or approved, return success
    if (order.status === 'SUCCESS' || order.status === 'APPROVED') {
      return NextResponse.json({
        status: 'SUCCESS',
        orderId: order.order_id,
        amount: order.amount_usd.toFixed(2),
        txHash: order.tx_hash,
      });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = order.expires_at ? new Date(order.expires_at) : null;
    
    if (order.status === 'EXPIRED' || (expiresAt && now > expiresAt)) {
      if (order.status !== 'EXPIRED') {
        await supabase
          .from('wallet_deposits')
          .update({ status: 'EXPIRED', updated_at: now.toISOString() })
          .eq('id', order.id);
      }
      return NextResponse.json({
        status: 'EXPIRED',
        orderId: order.order_id,
        amount: order.amount_usd.toFixed(2),
      });
    }

    // Run on-chain verification
    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
    const transactions = await getOnChainTransactions(adminWalletAddress);

    // Look for a matching transaction
    const match = await findMatchingOnChainTx(supabase, transactions, order, adminWalletAddress);

    if (match) {
      // 1. Update order status to SUCCESS
      const { data: updatedDeposit, error: updateErr } = await supabase
        .from('wallet_deposits')
        .update({
          status: 'SUCCESS',
          tx_hash: match.hash,
          on_chain_verified: true,
          on_chain_network: 'TRON_GRID',
          on_chain_from: match.from,
          on_chain_to: match.to,
          on_chain_amount: match.amountUSD,
          on_chain_tx_hash: match.hash,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id)
        .select()
        .single();

      if (updateErr || !updatedDeposit) {
        console.error('Update status to success error:', updateErr);
        return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
      }

      // 2. Create the Ledger Transaction to credit balance
      const { error: ledgerErr } = await supabase
        .from('transactions')
        .insert({
          user_id: order.user_id,
          transaction_type: 'DEPOSIT',
          amount_usd: order.amount_usd,
          amount_inr: order.equivalent_inr,
          reference: order.id,
          status: 'COMPLETED',
        });

      if (ledgerErr) {
        console.error('Create deposit ledger entry error:', ledgerErr);
      }

      return NextResponse.json({
        status: 'SUCCESS',
        orderId: order.order_id,
        amount: order.amount_usd.toFixed(2),
        txHash: match.hash,
      });
    }

    // Still pending
    return NextResponse.json({
      status: 'PENDING',
      orderId: order.order_id,
      amount: order.amount_usd.toFixed(2),
    });
  } catch (error: any) {
    console.error('Payment order status API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
