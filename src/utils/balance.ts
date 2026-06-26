interface Pool {
  id: string;
  usd: number;
  inr: number;
  rate: number;
}

export function simulateFIFO(deposits: any[], withdrawals: any[], currentRate: number = 83.50): {
  pools: Pool[];
  availableUSD: number;
  availableINR: number;
} {
  // Sort deposits in ascending order of creation (oldest first)
  const sortedDeposits = [...deposits]
    .filter(d => ['APPROVED', 'SUCCESS'].includes(d.status))
    .sort((a, b) => new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime());

  const pools: Pool[] = sortedDeposits.map(d => {
    const usd = d.amount_usd !== undefined ? d.amount_usd : (d.amountUSD || 0);
    const rate = d.admin_entered_rate !== undefined ? d.admin_entered_rate : (d.adminEnteredRate || currentRate);
    const inr = d.equivalent_inr !== undefined ? d.equivalent_inr : (d.equivalentINR || (usd * rate));
    return {
      id: d.id,
      usd,
      inr,
      rate
    };
  });

  // Sort withdrawals in ascending order of creation (oldest first)
  const sortedWithdrawals = [...withdrawals]
    .filter(w => ['PENDING', 'APPROVED', 'PAID'].includes(w.status))
    .sort((a, b) => new Date(a.created_at || a.createdAt).getTime() - new Date(b.created_at || b.createdAt).getTime());

  for (const w of sortedWithdrawals) {
    const wMethod = w.method;
    const wAmountUSD = w.amount_usd !== undefined ? w.amount_usd : (w.amountUSD || 0);
    const wAmountINR = w.amount_inr !== undefined ? w.amount_inr : (w.amountINR || 0);

    if (wMethod === 'USDT') {
      const fee = 0.5;
      let usdToDeduct = wAmountUSD + fee;
      
      for (const pool of pools) {
        if (usdToDeduct <= 0) break;
        if (pool.usd <= 0) continue;

        const consumedUSD = Math.min(usdToDeduct, pool.usd);
        pool.usd -= consumedUSD;
        pool.inr = pool.usd * pool.rate;
        usdToDeduct -= consumedUSD;
      }
    } else {
      // BANK (INR withdrawal)
      let inrToDeduct = wAmountINR;
      
      for (const pool of pools) {
        if (inrToDeduct <= 0) break;
        if (pool.inr <= 0) continue;

        const consumedINR = Math.min(inrToDeduct, pool.inr);
        pool.inr -= consumedINR;
        pool.usd = pool.inr / pool.rate;
        inrToDeduct -= consumedINR;
      }
    }
  }

  const availableUSD = pools.reduce((acc, p) => acc + p.usd, 0);
  const availableINR = pools.reduce((acc, p) => acc + p.inr, 0);

  return { pools, availableUSD, availableINR };
}
