import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getWalletOnChainDetails, getOnChainTransactions } from '@/utils/blockchain';

async function verifyAdmin(supabase: any) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized', status: 401 };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'ADMIN') {
    return { error: 'Forbidden', status: 403 };
  }
  return { user, profile };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const adminCheck = await verifyAdmin(supabase);
    if ('error' in adminCheck) {
      return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
    }

    // Fetch counts and sums
    const [usersCount, depositsRes, withdrawalsRes, pendingDepositsCount, pendingWithdrawalsCount] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'USER'),
      supabase.from('wallet_deposits').select('amount_usd').in('status', ['APPROVED', 'SUCCESS']),
      supabase.from('withdrawals').select('amount_inr').eq('status', 'PAID'),
      supabase.from('wallet_deposits').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'CANCEL_REQUESTED']),
      supabase.from('withdrawals').select('id', { count: 'exact', head: true }).in('status', ['PENDING', 'CANCEL_REQUESTED']),
    ]);

    const totalUsers = usersCount.count || 0;
    const totalDepositsUSD = (depositsRes.data || []).reduce((acc, d) => acc + d.amount_usd, 0);
    const totalWithdrawalsINR = (withdrawalsRes.data || []).reduce((acc, w) => acc + w.amount_inr, 0);
    const pendingDeposits = pendingDepositsCount.count || 0;
    const pendingWithdrawals = pendingWithdrawalsCount.count || 0;
    const pendingRequests = pendingDeposits + pendingWithdrawals;

    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS || '';
    let ethBalance = 0;
    let usdtBalance = 0;
    let onChainTransactions: any[] = [];

    if (adminWalletAddress) {
      try {
        const [details, txs] = await Promise.all([
          getWalletOnChainDetails(adminWalletAddress),
          getOnChainTransactions(adminWalletAddress)
        ]);
        ethBalance = details.ethBalance;
        usdtBalance = details.usdtBalance;
        onChainTransactions = txs;
      } catch (err) {
        console.error('Error fetching admin wallet details:', err);
      }
    }

    return NextResponse.json({
      totalUsers,
      totalDepositsUSD,
      totalWithdrawalsINR,
      pendingRequests,
      pendingDeposits,
      pendingWithdrawals,
      walletDetails: {
        address: adminWalletAddress,
        ethBalance,
        usdtBalance,
        etherscanConfigured: !!(process.env.TRONSCAN_API_KEY && process.env.TRONSCAN_API_KEY !== 'YOUR_API_KEY_HERE'),
        onChainTransactions
      }
    });
  } catch (error: any) {
    console.error('Admin stats API error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
