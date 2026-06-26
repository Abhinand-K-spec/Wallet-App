async function test() {
  const address = 'TD2vA4e994Ki6VBfYUKGmKobXPry3NHf8J';
  const apiKey = 'b570a667-729f-4b98-9804-a182c851647d';
  
  console.log("=== API KEY METHOD (Tronscan) ===");
  try {
    const headers = { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' };
    const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?relatedAddress=${address}&start=0&limit=10`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    console.log("Tronscan response size:", data?.token_transfers?.length || 0);
    if (data?.token_transfers) {
      data.token_transfers.forEach(tx => {
        const decimals = Number(tx.tokenInfo?.tokenDecimal || 6);
        const amount = Number(tx.quant || tx.amount_str || tx.amount || 0) / Math.pow(10, decimals);
        console.log(`Hash: ${tx.transaction_id || tx.tx_id}`);
        console.log(`From: ${tx.from_address} -> To: ${tx.to_address}`);
        console.log(`Amount: ${amount} ${tx.tokenInfo?.tokenAbbr}`);
        console.log(`Time: ${new Date(Number(tx.block_ts || tx.timestamp || 0))}`);
        console.log("-------------------");
      });
    }
  } catch (err) {
    console.error(err);
  }

  console.log("\n=== KEYLESS METHOD (TronGrid) ===");
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=10`;
    const res = await fetch(url);
    const json = await res.json();
    console.log("TronGrid response size:", json?.data?.length || 0);
    if (json?.data) {
      json.data.forEach(tx => {
        const decimals = Number(tx.token_info?.decimals || 6);
        const amount = Number(tx.value) / Math.pow(10, decimals);
        console.log(`Hash: ${tx.transaction_id}`);
        console.log(`From: ${tx.from} -> To: ${tx.to}`);
        console.log(`Amount: ${amount} ${tx.token_info?.symbol}`);
        console.log(`Time: ${new Date(Number(tx.block_timestamp || 0))}`);
        console.log("-------------------");
      });
    }
  } catch (err) {
    console.error(err);
  }
}

test();
