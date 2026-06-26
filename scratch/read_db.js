const { createClient } = require('@supabase/supabase-js');

// Load environment variables manually
const supabaseUrl = 'https://wimcvwamnebuzvrzzgsy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbWN2d2FtbmVidXp2cnp6Z3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyODIwMDYsImV4cCI6MjA5Nzg1ODAwNn0.R-cO68hsDPhgzOIiZzz6o5NIrvQ3__HnELI71JCWQfU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log("=== CHECKING WALLET DEPOSITS ===");
  const { data: deposits, error: depErr } = await supabase
    .from('wallet_deposits')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (depErr) console.error("Error deposits:", depErr);
  else console.log("Deposits count:", deposits.length, deposits);

  console.log("\n=== CHECKING WITHDRAWALS ===");
  const { data: withdrawals, error: withErr } = await supabase
    .from('withdrawals')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (withErr) console.error("Error withdrawals:", withErr);
  else console.log("Withdrawals count:", withdrawals.length, withdrawals);

  console.log("\n=== CHECKING PAYMENT PROOFS ===");
  const { data: proofs, error: proofErr } = await supabase
    .from('payment_proofs')
    .select('*');
    
  if (proofErr) console.error("Error proofs:", proofErr);
  else console.log("Proofs count:", proofs.length, proofs);
}

checkDb();
