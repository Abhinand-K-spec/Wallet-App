-- ==========================================
-- Supabase Schema for Wallet Application
-- Paste this script into your Supabase SQL Editor and click RUN
-- ==========================================

-- 1. Profiles Table (maps to User model in Prisma)
-- Extends Supabase auth.users table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER', 'ADMIN')),
  status VARCHAR(20) DEFAULT 'ACTIVE' NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable Row Level Security (disabled for simple BFF management, but can be enabled later)
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Wallet Deposits Table
CREATE TABLE IF NOT EXISTS public.wallet_deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  wallet_address VARCHAR(255),
  tx_hash VARCHAR(255) UNIQUE,
  amount_usd DOUBLE PRECISION NOT NULL,
  equivalent_inr DOUBLE PRECISION,
  admin_entered_rate DOUBLE PRECISION,
  status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SUCCESS', 'FAILED', 'EXPIRED')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  on_chain_verified BOOLEAN DEFAULT FALSE NOT NULL,
  on_chain_network VARCHAR(50),
  on_chain_from VARCHAR(255),
  on_chain_to VARCHAR(255),
  on_chain_amount DOUBLE PRECISION,
  on_chain_tx_hash VARCHAR(255),
  order_id VARCHAR(100) UNIQUE,
  network VARCHAR(50) DEFAULT 'TRC20',
  currency VARCHAR(50) DEFAULT 'USDT',
  expires_at TIMESTAMPTZ,
  qr_payload TEXT
);

-- 3. Transactions Table (Ledger)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'WITHDRAWAL')),
  amount_usd DOUBLE PRECISION NOT NULL,
  amount_inr DOUBLE PRECISION,
  reference VARCHAR(255), -- ID of the deposit or withdrawal
  status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount_usd DOUBLE PRECISION NOT NULL,
  amount_inr DOUBLE PRECISION NOT NULL,
  method VARCHAR(20) DEFAULT 'BANK' NOT NULL CHECK (method IN ('BANK', 'USDT')),
  account_holder VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  ifsc VARCHAR(50),
  wallet_address VARCHAR(255),
  status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  approved_by UUID REFERENCES public.profiles(id),
  utr VARCHAR(255),
  downloaded BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Admin Actions Table
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(255) NOT NULL,
  target_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(255) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
);

-- Seed USD to INR rate if not set
INSERT INTO public.system_settings (key, value)
VALUES ('USD_INR_RATE', '83.50')
ON CONFLICT (key) DO NOTHING;

-- 7. Trigger to automatically create a profile when a new user signs up in Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  profile_count integer;
  custom_user_id text;
BEGIN
  -- Generate sequential USR-100x IDs
  SELECT COALESCE(count(*), 0) INTO profile_count FROM public.profiles;
  custom_user_id := 'USR-' || (1000 + profile_count);

  -- Admin auto-role override for convenience
  IF new.email = 'admin@wallet.com' THEN
    INSERT INTO public.profiles (id, user_id, email, role, status)
    VALUES (new.id, 'USR-ADMIN', new.email, 'ADMIN', 'ACTIVE');
  ELSE
    INSERT INTO public.profiles (id, user_id, email, role, status)
    VALUES (new.id, custom_user_id, new.email, 'USER', 'ACTIVE');
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
