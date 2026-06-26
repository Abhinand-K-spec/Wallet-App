import Tesseract from 'tesseract.js';

export interface OcrResult {
  rawText: string;
  amount: string;
  currency: string;
  reference: string;
  bank: string;
  sender: string;
  receiver: string;
  account: string;
  wallet: string;
  date: string;
  time: string;
  status: string;
  confidence: Record<string, number>;
}

export async function processOcr(
  filePath: string,
  fileName: string,
  requestData?: { amount: number; currency: string; type: 'DEPOSIT' | 'WITHDRAWAL'; reference?: string; wallet?: string; account?: string }
): Promise<OcrResult> {
  console.log(`[OCR Service] Starting real OCR processing on file: ${filePath}`);
  
  let rawText = '';
  try {
    const ocrResult = await Tesseract.recognize(filePath, 'eng');
    rawText = ocrResult.data.text || '';
    console.log(`[OCR Service] Successfully extracted text of length ${rawText.length}`);
  } catch (err) {
    console.error('[OCR Service] Error running Tesseract OCR:', err);
    rawText = '';
  }

  // Initialize fields
  let amount = '';
  let currency = '';
  let reference = '';
  let bank = '';
  let sender = '';
  let receiver = '';
  let account = '';
  let wallet = '';
  let date = '';
  let time = '';
  let status = '';

  const confidence: Record<string, number> = {
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

  if (!rawText.trim()) {
    return {
      rawText: 'No readable text was extracted from this payment proof slip.',
      amount, currency, reference, bank, sender, receiver, account, wallet, date, time, status, confidence
    };
  }

  // 1. Extract Currency & Amount
  if (/usdt/i.test(rawText)) {
    currency = 'USDT';
    confidence.currency = 0.95;
  } else if (/inr|₹|rs|imps|upi/i.test(rawText)) {
    currency = 'INR';
    confidence.currency = 0.95;
  } else if (/usd|\$/i.test(rawText)) {
    currency = 'USD';
    confidence.currency = 0.95;
  }

  // Find floating point numbers like 1000.00 or 10,000.00
  // Clean dates and times from string first to avoid partial matches
  const cleanedTextForAmount = rawText
    .replace(/\b\d{2}:\d{2}(?::\d{2})?\b/g, '')
    .replace(/\b\d{2,4}[-/.]\d{2}[-/.]\d{2,4}\b/g, '');

  const amountRegex = /(?:amount|amt)?\s*(?:usdt|usd|inr|₹|rs\.?)?\s*\b(\d+(?:,\d{3})*(?:\.\d{2}))\b/i;
  const amountMatch = cleanedTextForAmount.match(amountRegex);
  if (amountMatch) {
    amount = amountMatch[1].replace(/,/g, '');
    confidence.amount = 0.95;
  } else {
    // General float fallback
    const generalFloatRegex = /\b(\d+\.\d{2})\b/;
    const generalMatch = cleanedTextForAmount.match(generalFloatRegex);
    if (generalMatch) {
      amount = generalMatch[1];
      confidence.amount = 0.80;
    }
  }

  // 2. Extract Reference / TxID / UTR
  const tronTxRegex = /\b([A-Fa-f0-9]{64})\b/;
  const tronTxMatch = rawText.match(tronTxRegex);
  if (tronTxMatch) {
    reference = tronTxMatch[1];
    confidence.reference = 0.99;
  } else {
    const utrRegex = /\b(\d{12})\b/;
    const utrMatch = rawText.match(utrRegex);
    if (utrMatch) {
      reference = utrMatch[1];
      confidence.reference = 0.95;
    } else {
      const genRefRegex = /(?:ref|utr|txn|transaction|transfer)\s*(?:no|num|number|id)?\s*[:.-]?\s*\b([a-z0-9-]{8,24})\b/i;
      const genRefMatch = rawText.match(genRefRegex);
      if (genRefMatch) {
        reference = genRefMatch[1];
        confidence.reference = 0.85;
      } else {
        const fallbackRefRegex = /\b([A-Z0-9]{15,22})\b/;
        const fallbackRefMatch = rawText.match(fallbackRefRegex);
        if (fallbackRefMatch) {
          reference = fallbackRefMatch[1];
          confidence.reference = 0.70;
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

  // 9. Extract Sender & Receiver
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

