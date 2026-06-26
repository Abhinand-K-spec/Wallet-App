function parseOcrText(rawText) {
  // Initialize fields
  let amount = "";
  let currency = "";
  let reference = "";
  let bank = "";
  let sender = "";
  let receiver = "";
  let account = "";
  let wallet = "";
  let date = "";
  let time = "";
  let status = "";

  const confidence = {
    amount: 0.0,
    currency: 0.0,
    reference: 0.0,
    bank: 0.0,
    sender: 0.0,
    receiver: 0.0,
    account: 0.0,
    wallet: 0.0,
    date: 0.0,
    time: 0.0,
    status: 0.0,
  };

  // 1. Extract Currency & Amount
  // Look for currency indicators
  if (/usdt/i.test(rawText)) {
    currency = "USDT";
    confidence.currency = 0.95;
  } else if (/inr|₹|rs|imps|upi/i.test(rawText)) {
    currency = "INR";
    confidence.currency = 0.95;
  } else if (/usd|\$/i.test(rawText)) {
    currency = "USD";
    confidence.currency = 0.95;
  }

  // Find floating point numbers like 1000.00 or 10,000.00 or 100000.00
  // Avoid matching date components or times
  const cleanedTextForAmount = rawText.replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, "").replace(/\b\d{2,4}[-/.]\d{2}[-/.]\d{2,4}\b/g, "");
  const amountRegex = /(?:amount|amt)?\s*(?:usdt|usd|inr|₹|rs\.?)?\s*\b(\d+(?:,\d{3})*(?:\.\d{2}))\b/i;
  const amountMatch = cleanedTextForAmount.match(amountRegex);
  if (amountMatch) {
    amount = amountMatch[1].replace(/,/g, "");
    confidence.amount = 0.95;
  } else {
    // General float fallback
    const generalFloatRegex = /\b(\d+\.\d{2})\b/;
    const generalMatch = cleanedTextForAmount.match(generalFloatRegex);
    if (generalMatch) {
      amount = generalMatch[1];
      confidence.amount = 0.85;
    }
  }

  // 2. Extract Reference / TxID / UTR
  // 2.1 TRON Address or TxID (64 char hex)
  const tronTxRegex = /\b([A-Fa-f0-9]{64})\b/;
  const tronTxMatch = rawText.match(tronTxRegex);
  if (tronTxMatch) {
    reference = tronTxMatch[1];
    confidence.reference = 0.99;
  } else {
    // 2.2 UTR (12 digits)
    const utrRegex = /\b(\d{12})\b/;
    const utrMatch = rawText.match(utrRegex);
    if (utrMatch) {
      reference = utrMatch[1];
      confidence.reference = 0.95;
    } else {
      // 2.3 General Transaction ID patterns
      const genRefRegex = /(?:ref|utr|txn|transaction|transfer)\s*(?:no|num|number|id)?\s*[:.-]?\s*\b([a-z0-9-]{8,24})\b/i;
      const genRefMatch = rawText.match(genRefRegex);
      if (genRefMatch) {
        reference = genRefMatch[1];
        confidence.reference = 0.85;
      } else {
        // Fallback: check for any 9+ alphanumeric uppercase string that isn't the account number
        const fallbackRefRegex = /\b([A-Z0-9]{15,22})\b/;
        const fallbackRefMatch = rawText.match(fallbackRefRegex);
        if (fallbackRefMatch) {
          reference = fallbackRefMatch[1];
          confidence.reference = 0.75;
        }
      }
    }
  }

  // 3. Extract Wallet Address
  const walletRegex = /\b(T[A-Za-z0-9]{33})\b|\b(0x[A-Fa-f0-9]{40})\b/;
  const walletMatch = rawText.match(walletRegex);
  if (walletMatch) {
    wallet = walletMatch[0];
    confidence.wallet = 0.98;
  }

  // 4. Extract Account Number
  // Look for sequence of digits (9 to 18 digits) that isn't already used as reference or UTR
  const digitSequences = rawText.match(/\b\d{9,18}\b/g) || [];
  for (const seq of digitSequences) {
    if (seq !== reference && seq !== wallet) {
      account = seq;
      confidence.account = 0.85;
      break;
    }
  }

  // 5. Extract Date
  const dateRegexes = [
    /\b(\d{2}[-/.]\d{2}[-/.]\d{4})\b/,
    /\b(\d{4}[-/.]\d{2}[-/.]\d{2})\b/,
    /\b(\d{2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i
  ];
  for (const r of dateRegexes) {
    const m = rawText.match(r);
    if (m) {
      date = m[1];
      confidence.date = 0.95;
      break;
    }
  }

  // 6. Extract Time
  const timeRegex = /\b(\d{2}:\d{2}(?::\d{2})?)\b/;
  const timeMatch = rawText.match(timeRegex);
  if (timeMatch) {
    time = timeMatch[1];
    confidence.time = 0.95;
  }

  // 7. Extract Status
  const statusMatch = rawText.match(/\b(success|completed|successful|paid|pending|failed|declined)\b/i);
  if (statusMatch) {
    status = statusMatch[1].toUpperCase();
    confidence.status = 0.98;
  }

  // 8. Extract Bank Name
  const bankMatch = rawText.match(/\b(hdfc|icici|sbi|axis|kotak|pnb|canara|union|yes bank|hsbc|gpay|paytm|phonepe|imps|upi|binance|trust wallet)\b/i);
  if (bankMatch) {
    bank = bankMatch[1].toUpperCase();
    confidence.bank = 0.90;
  }

  // 9. Extract Sender & Receiver (usually requires labels, else remains empty/low confidence)
  const senderMatch = rawText.match(/(?:sender|from|paid by)\s*[:.-]?\s*\b([a-z\s]{3,20})\b/i);
  if (senderMatch) {
    sender = senderMatch[1].trim();
    confidence.sender = 0.85;
  }
  
  const receiverMatch = rawText.match(/(?:receiver|to|beneficiary|paid to)\s*[:.-]?\s*\b([a-z\s]{3,20})\b/i);
  if (receiverMatch) {
    receiver = receiverMatch[1].trim();
    confidence.receiver = 0.85;
  }

  return {
    rawText,
    amount,
    currency,
    reference,
    bank,
    sender,
    receiver,
    account,
    wallet,
    date,
    time,
    status,
    confidence
  };
}

const rawText = "FT CS [3\n14:49 20/09/2025 1C25092014492213465 10094100013581 IMPS 100000.00 526399164990 SUCCESS";
console.log(parseOcrText(rawText));
