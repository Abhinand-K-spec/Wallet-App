'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface PaymentAmountInputProps {
  amount: string;
  currency: 'USDT' | 'INR';
  onChangeAmount: (val: string) => void;
  onChangeCurrency: (val: 'USDT' | 'INR') => void;
  exchangeRate: number;
  disabled?: boolean;
}

export const PaymentAmountInput: React.FC<PaymentAmountInputProps> = ({
  amount,
  currency,
  onChangeAmount,
  onChangeCurrency,
  exchangeRate,
  disabled = false,
}) => {
  const numAmount = parseFloat(amount) || 0;
  
  // Calculate conversions
  const convertedAmount = currency === 'INR' 
    ? (numAmount / exchangeRate) 
    : (numAmount * exchangeRate);

  const displayConverted = isNaN(convertedAmount) 
    ? (currency === 'INR' ? '0.0000' : '0.00') 
    : convertedAmount.toFixed(currency === 'INR' ? 4 : 2);
  const displayEntered = numAmount > 0 
    ? numAmount.toFixed(currency === 'USDT' ? 4 : 2) 
    : (currency === 'USDT' ? '0.0000' : '0.00');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow numeric, single decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      onChangeAmount(value);
    }
  };

  return (
    <div className="bg-gray-950/40 p-5 border border-gray-800/80 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5 font-sans">
          Enter Deposit Amount
        </span>
        <div className="flex bg-gray-900 border border-gray-800 rounded-lg p-0.5 font-sans">
          <button
            type="button"
            onClick={() => onChangeCurrency('USDT')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              currency === 'USDT'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            USDT
          </button>
          <button
            type="button"
            onClick={() => onChangeCurrency('INR')}
            disabled={disabled}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              currency === 'INR'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            INR
          </button>
        </div>
      </div>

      <div className="relative font-sans">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleInputChange}
          disabled={disabled}
          className="w-full bg-gray-950 border border-gray-800 text-white rounded-xl px-4 py-3.5 pl-11 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-medium text-lg placeholder-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder={currency === 'USDT' ? '0.0000' : '0'}
          required
        />
        <span className="absolute left-4 top-4 text-gray-400 font-semibold text-lg">
          {currency === 'USDT' ? '$' : '₹'}
        </span>
      </div>

      {/* Info Display Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs border-t border-gray-900 font-sans">
        <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-900">
          <span className="text-gray-500 block mb-0.5">Entered Amount</span>
          <span className="font-bold text-white text-sm">
            {currency === 'USDT' ? `$${displayEntered} USDT` : `₹${displayEntered} INR`}
          </span>
        </div>

        <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-900">
          <span className="text-gray-500 block mb-0.5">
            {currency === 'USDT' ? 'Equivalent INR' : 'Converted to USDT'}
          </span>
          <span className="font-bold text-indigo-400 text-sm">
            {currency === 'USDT' ? `₹${displayConverted} INR` : `$${displayConverted} USDT`}
          </span>
        </div>

        <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-900 flex flex-col justify-between">
          <span className="text-gray-500 block mb-0.5">Target Network</span>
          <span className="font-bold text-emerald-400 text-sm flex items-center gap-1">
            TRC20 (TRON)
            <span title="USDT payments must be sent via the TRC20 network only" className="cursor-help inline-flex items-center">
              <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
