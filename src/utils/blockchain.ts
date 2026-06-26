interface OnChainResult {
  success: boolean;
  network: string;
  fromAddress: string;
  toAddress: string;
  amountUSD: number;
  txHash?: string;
  message?: string;
}

// Ethereum helpers removed (TRC20/TRON only support)


// ---------------------------------------------------------
// TRON (TRC-20 USDT) HELPERS
// ---------------------------------------------------------

const verifyTronUSDT = async (txHash: string, expectedRecipient: string, apiKey: string): Promise<OnChainResult> => {
  const cleanHash = txHash.trim();
  const lowerHash = cleanHash.toLowerCase();

  // Explicit mock support: must start with 'mock' or 'test'
  if (lowerHash.startsWith('mock') || lowerHash.startsWith('test')) {
    // Attempt to parse amount from the hash (e.g., mock_100 -> 100, test_500.5 -> 500.5)
    const match = lowerHash.match(/(?:mock_|test_|mock|test)([\d.]+)/);
    // If no valid number is specified, do NOT auto-match any arbitrary number like 1000
    const amountUSD = match ? parseFloat(match[1]) : -1.0;

    console.log(`[Tron Verification] Mock transaction detected. Mapped Amount: $${amountUSD}`);
    if (amountUSD >= 0) {
      return {
        success: true,
        network: 'MOCK_TRON',
        fromAddress: 'TMockUserWalletAddress777777777777777',
        toAddress: expectedRecipient,
        amountUSD,
        txHash: cleanHash,
      };
    } else {
      return {
        success: false,
        network: 'MOCK_TRON',
        fromAddress: '',
        toAddress: '',
        amountUSD: 0,
        message: 'Mock transaction amount not specified in hash. Use mock_[amount] or test_[amount] format (e.g., mock_100).',
      };
    }
  }

  const tronHashRegex = /^(0x)?[A-Fa-f0-9]{64}$/;
  if (!tronHashRegex.test(cleanHash)) {
    console.log(`[Tron Verification] TxHash '${cleanHash}' is not a standard Tron hash and has no mock prefix. Verification failed.`);
    return {
      success: false,
      network: 'TRON',
      fromAddress: '',
      toAddress: '',
      amountUSD: 0,
      message: 'Invalid transaction hash format. Standard Tron transaction hash must be a 64-character hex string, or mock_[amount] for testing.',
    };
  }

  const cleanHashHex = cleanHash.replace('0x', '').toLowerCase();
  
  // Method 1: Try Tronscan API if key is valid and not equal to address
  const isKeyValid = apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey !== expectedRecipient;
  if (isKeyValid) {
    try {
      const url = `https://apilist.tronscanapi.com/api/transaction-info?hash=${cleanHashHex}`;
      const res = await fetch(url, { headers: { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' } });
      const txData = await res.json();

      if (txData && txData.hash && txData.contractRet === 'SUCCESS') {
        const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
        const transfers = txData.trc20TransferInfo || [];
        const transfer = transfers.find((t: any) => 
          t.to_address.toLowerCase() === expectedRecipient.toLowerCase() &&
          t.token_id === usdtContract
        );

        if (transfer) {
          const decimals = Number(transfer.decimals || 6);
          const amountUSD = Number(transfer.amount_str) / Math.pow(10, decimals);
          return {
            success: true,
            network: 'TRON',
            fromAddress: transfer.from_address,
            toAddress: transfer.to_address,
            amountUSD,
            txHash: txData.hash,
          };
        }
      }
    } catch (err) {
      console.warn('[Tron Verification] Tronscan API verification failed, trying TRONGrid fallback:', err);
    }
  }

  // Method 2: Fallback/Primary keyless verification via TRONGrid Accounts transfers
  try {
    const url = `https://api.trongrid.io/v1/accounts/${expectedRecipient}/transactions/trc20?limit=50&only_confirmed=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.success && Array.isArray(data.data)) {
      const matchedTx = data.data.find((tx: any) => tx.transaction_id.toLowerCase() === cleanHashHex);
      if (matchedTx) {
        const decimals = Number(matchedTx.token_info?.decimals || 6);
        const amountUSD = Number(matchedTx.value) / Math.pow(10, decimals);
        return {
          success: true,
          network: 'TRON_GRID',
          fromAddress: matchedTx.from,
          toAddress: matchedTx.to,
          amountUSD,
          txHash: matchedTx.transaction_id,
        };
      }
    }
  } catch (err) {
    console.error('[Tron Verification] TRONGrid verification failed:', err);
  }

  return {
    success: false,
    network: 'TRON',
    fromAddress: '',
    toAddress: '',
    amountUSD: 0,
    message: 'Transaction not found or not confirmed on the TRON network.',
  };
};

const getTronWalletDetails = async (address: string, apiKey: string) => {
  let trxBalance = 0;
  let usdtBalance = 0;

  // Try Tronscan API if key is valid
  const isKeyValid = apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey !== address;
  if (isKeyValid) {
    try {
      const headers = { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' };
      const accountUrl = `https://apilist.tronscanapi.com/api/account?address=${address}`;
      const accountRes = await fetch(accountUrl, { headers });
      const accountData = await accountRes.json();
      if (accountData && typeof accountData.balance === 'number') {
        trxBalance = accountData.balance / 1e6;
      }

      const tokensUrl = `https://apilist.tronscanapi.com/api/account/tokens?address=${address}&show=2`;
      const tokensRes = await fetch(tokensUrl, { headers });
      const tokensData = await tokensRes.json();
      if (tokensData && Array.isArray(tokensData.data)) {
        for (const token of tokensData.data) {
          if (token.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t') {
            usdtBalance = Number(token.balance) / Math.pow(10, token.tokenDecimal || 6);
          }
        }
        return { ethBalance: trxBalance, usdtBalance };
      }
    } catch (err) {
      console.warn('[Tron Connection] Tronscan API balance fetch failed, trying TRONGrid fallback:', err);
    }
  }

  // Fallback to keyless TRONGrid Account query
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.success && json.data && json.data[0]) {
      const account = json.data[0];
      trxBalance = (account.balance || 0) / 1e6;

      const trc20Balances = account.trc20 || [];
      const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
      const usdtBalanceRaw = trc20Balances.find((tokenObj: any) => tokenObj[usdtContract] !== undefined);
      if (usdtBalanceRaw) {
        usdtBalance = Number(usdtBalanceRaw[usdtContract]) / 1e6;
      }
    }
  } catch (err) {
    console.error('[Tron Connection] TRONGrid balance fetch failed:', err);
  }

  return { ethBalance: trxBalance, usdtBalance };
};

const getTronOnChainTransactions = async (address: string, apiKey: string): Promise<any[]> => {
  // Try Tronscan API if key is valid
  const isKeyValid = apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey !== address;
  if (isKeyValid) {
    try {
      const headers = { 'TRON-PRO-API-KEY': apiKey, 'Accept': 'application/json' };
      const url = `https://apilist.tronscanapi.com/api/token_trc20/transfers?relatedAddress=${address}&start=0&limit=10`;
      const res = await fetch(url, { headers });
      const data = await res.json();

      if (data && Array.isArray(data.token_transfers)) {
        return data.token_transfers.map((tx: any) => {
          const decimals = Number(tx.tokenInfo?.tokenDecimal || 6);
          const amount = Number(tx.quant || tx.amount_str || tx.amount || 0) / Math.pow(10, decimals);
          return {
            hash: tx.transaction_id || tx.tx_id,
            from: tx.from_address,
            to: tx.to_address,
            amountUSD: amount,
            timestamp: Number(tx.block_ts || tx.timestamp || 0),
            blockNumber: String(tx.block || ''),
            tokenSymbol: tx.tokenInfo?.tokenAbbr || tx.tokenInfo?.tokenSymbol || 'TRC20'
          };
        });
      }
    } catch (err) {
      console.warn('[Tron Connection] Tronscan API transfers fetch failed, trying TRONGrid fallback:', err);
    }
  }

  // Fallback to keyless TRONGrid Accounts TRC20 transfers query
  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20?limit=10`;
    const res = await fetch(url);
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data)) {
      return json.data.map((tx: any) => {
        const decimals = Number(tx.token_info?.decimals || 6);
        const amount = Number(tx.value) / Math.pow(10, decimals);
        return {
          hash: tx.transaction_id,
          from: tx.from,
          to: tx.to,
          amountUSD: amount,
          timestamp: Number(tx.block_timestamp || 0),
          blockNumber: '',
          tokenSymbol: tx.token_info?.symbol || 'TRC20'
        };
      });
    }
  } catch (err) {
    console.error('[Tron Connection] TRONGrid transfers fetch failed:', err);
  }

  return [];
};


// ---------------------------------------------------------
// EXPORTED ROUTER INTERFACE (TRC-20 / TRON ONLY)
// ---------------------------------------------------------

export const verifyOnChainUSDT = async (txHash: string, expectedRecipient: string): Promise<OnChainResult> => {
  const apiKey = process.env.TRONSCAN_API_KEY || '';
  return verifyTronUSDT(txHash, expectedRecipient, apiKey);
};

export const getWalletOnChainDetails = async (address: string) => {
  const apiKey = process.env.TRONSCAN_API_KEY || '';
  return getTronWalletDetails(address, apiKey);
};

export const getOnChainTransactions = async (address: string): Promise<any[]> => {
  const apiKey = process.env.TRONSCAN_API_KEY || '';
  return getTronOnChainTransactions(address, apiKey);
};
