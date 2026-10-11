-- ==============================================================================
-- QuickPrint Complete Supabase Schema (current.sql)
-- Architecture: Zero-Login Walk-In Kiosk & Merchant Print Station
-- Roles: 'merchant' (station owners) and 'user' (anonymous walk-in customers)
-- No customer accounts, passwords, or personal PII stored.
-- ==============================================================================

-- 1. CLEANUP LEGACY ARTIFACTS & OVERLOADED FUNCTIONS
-- Drops unused legacy customer tables/functions and any previously overloaded RPCs
DROP TABLE IF EXISTS public.customers CASCADE;

-- Drops legacy columns if upgrading an existing database
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'print_jobs') THEN
    ALTER TABLE public.print_jobs DROP COLUMN IF EXISTS daily_token CASCADE;
    ALTER TABLE public.print_jobs DROP COLUMN IF EXISTS pickup_code CASCADE;
  END IF;
END $$;

-- Drops any previously overloaded RPC signatures to ensure clean unique creation
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS full_sig
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('increment_merchant_stats', 'confirm_payment_and_update_stats', 'complete_print_job', 'upsert_customer_profile')
  ) LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.full_sig || ' CASCADE;';
  END LOOP;
END $$;

-- 2. MERCHANTS TABLE
-- Stores print station configuration, pricing, shop code, and stats
CREATE TABLE IF NOT EXISTS public.merchants (
  id TEXT PRIMARY KEY,                           -- Firebase Auth UID
  email TEXT,
  role TEXT DEFAULT 'merchant',
  shop_code INT UNIQUE,                         -- 4-digit numeric station code (e.g. 8421)
  shop_name TEXT NOT NULL,
  owner_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  pincode INT,                                  -- 6-digit postal code (e.g. 400001)
  upi_id TEXT,
  price_per_page_bw NUMERIC(10, 2) DEFAULT 2.00,
  price_per_page_color NUMERIC(10, 2) DEFAULT 5.00,
  auto_accept_jobs BOOLEAN DEFAULT FALSE,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  stats JSONB DEFAULT '{
    "todayPrints": 0,
    "todayEarnings": 0,
    "monthPrints": 0,
    "monthEarnings": 0,
    "totalPrints": 0,
    "totalEarnings": 0,
    "lastResetDate": "",
    "lastResetMonth": ""
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure all columns exist on public.merchants (migration safety for existing DBs)
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'merchant';
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS shop_code INT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS pincode INT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS price_per_page_bw NUMERIC(10, 2) DEFAULT 2.00;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS price_per_page_color NUMERIC(10, 2) DEFAULT 5.00;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS auto_accept_jobs BOOLEAN DEFAULT FALSE;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{"todayPrints": 0, "todayEarnings": 0, "monthPrints": 0, "monthEarnings": 0, "totalPrints": 0, "totalEarnings": 0, "lastResetDate": "", "lastResetMonth": ""}'::jsonb;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW());

-- 3. PRINT JOBS TABLE
-- Stores orders placed by walk-in users identified by 4-digit token / OTP
CREATE TABLE IF NOT EXISTS public.print_jobs (
  id TEXT PRIMARY KEY,                           -- Unique client-side ID ('job_...')
  merchant_id TEXT NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  merchant_name TEXT,
  files JSONB NOT NULL DEFAULT '[]'::jsonb,      -- Array of file metadata (name, size, type, pageCount, specs)
  status TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'paymentClaimed' | 'printing' | 'ready' | 'completed' | 'cancelled'
  cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  total_pages INTEGER NOT NULL DEFAULT 1,
  bw_pages INTEGER DEFAULT 0,
  color_pages INTEGER DEFAULT 0,
  transport TEXT DEFAULT 'realtime',             -- 'realtime' (streamed directly via fast lane)
  payment_method TEXT DEFAULT 'cash',            -- 'cash' | 'upi'
  payment_status TEXT DEFAULT 'unpaid',          -- 'unpaid' | 'paid' | 'verified'
  token_number TEXT,                             -- Formatted display token (e.g. '#8421')
  pin TEXT,                                      -- 4-digit verification OTP (e.g. '8421')
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  paid_at TIMESTAMPTZ,                           -- Timestamp when customer payment was confirmed
  completed_at TIMESTAMPTZ                       -- Timestamp when print job was finished
);

-- Ensure all columns exist on public.print_jobs (migration safety for existing DBs)
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS merchant_name TEXT;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS files JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS total_pages INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS bw_pages INTEGER DEFAULT 0;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS color_pages INTEGER DEFAULT 0;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS transport TEXT DEFAULT 'realtime';
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS token_number TEXT;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.print_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 4. KEEPALIVE TABLE
-- Dedicated heartbeat table queried by GitHub Actions cron to prevent Supabase 7-day inactivity pause
CREATE TABLE IF NOT EXISTS public.keepalive (
  id INT PRIMARY KEY DEFAULT 1,
  last_ping TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  service TEXT DEFAULT 'quickprint'
);

-- Seed initial heartbeat row if absent
INSERT INTO public.keepalive (id, last_ping, service)
VALUES (1, TIMEZONE('utc'::text, NOW()), 'quickprint')
ON CONFLICT (id) DO NOTHING;

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_merchants_shop_code ON public.merchants (shop_code);
CREATE INDEX IF NOT EXISTS idx_print_jobs_merchant_id ON public.print_jobs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_merchant_status ON public.print_jobs (merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON public.print_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_pin ON public.print_jobs (pin);

-- 6. REALTIME REPLICATION SETUP
-- Enables live WebSocket event broadcast for merchant print queue & user receipt
ALTER TABLE public.merchants REPLICA IDENTITY FULL;
ALTER TABLE public.print_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- Ensure publication exists
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'print_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'merchants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.merchants;
  END IF;
END $$;

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow idempotent execution
DROP POLICY IF EXISTS "Public read merchants" ON public.merchants;
DROP POLICY IF EXISTS "Merchants manage profile" ON public.merchants;
DROP POLICY IF EXISTS "Public read print_jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Public insert print_jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Public update print_jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Public delete print_jobs" ON public.print_jobs;
DROP POLICY IF EXISTS "Public read keepalive" ON public.keepalive;
DROP POLICY IF EXISTS "Public ping keepalive" ON public.keepalive;

-- Merchants Policies:
-- Allow customers to find merchants by shop_code or ID
CREATE POLICY "Public read merchants"
  ON public.merchants
  FOR SELECT
  USING (true);

-- Allow merchant registration and profile management
CREATE POLICY "Merchants manage profile"
  ON public.merchants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Print Jobs Policies:
-- Allow reading print jobs (for customer tracking & merchant queue)
CREATE POLICY "Public read print_jobs"
  ON public.print_jobs
  FOR SELECT
  USING (true);

-- Allow walk-in customers to submit print jobs without signing in
CREATE POLICY "Public insert print_jobs"
  ON public.print_jobs
  FOR INSERT
  WITH CHECK (true);

-- Allow updating jobs (user payment confirmation, merchant accept/complete)
CREATE POLICY "Public update print_jobs"
  ON public.print_jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Allow deleting jobs (merchant cleanup)
CREATE POLICY "Public delete print_jobs"
  ON public.print_jobs
  FOR DELETE
  USING (true);

-- Keepalive Policies:
-- Allow public select & update for GitHub Action heartbeats
CREATE POLICY "Public read keepalive"
  ON public.keepalive
  FOR SELECT
  USING (true);

CREATE POLICY "Public ping keepalive"
  ON public.keepalive
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 8. STORED PROCEDURES & ATOMIC RPCS

-- A. Increment Merchant Print Counts & Earnings
CREATE OR REPLACE FUNCTION public.increment_merchant_stats(
  p_merchant_id TEXT,
  p_pages NUMERIC DEFAULT 0,
  p_earnings NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_month TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM');
  v_stats JSONB;
  v_today_prints NUMERIC := 0;
  v_today_earnings NUMERIC := 0;
  v_month_prints NUMERIC := 0;
  v_month_earnings NUMERIC := 0;
  v_total_prints NUMERIC := 0;
  v_total_earnings NUMERIC := 0;
BEGIN
  SELECT stats INTO v_stats FROM public.merchants WHERE id = p_merchant_id;
  
  IF v_stats IS NOT NULL THEN
    -- Check daily rollover
    IF (v_stats->>'lastResetDate') = v_today THEN
      v_today_prints := COALESCE((v_stats->>'todayPrints')::NUMERIC, 0);
      v_today_earnings := COALESCE((v_stats->>'todayEarnings')::NUMERIC, 0);
    END IF;

    -- Check monthly rollover
    IF (v_stats->>'lastResetMonth') = v_month THEN
      v_month_prints := COALESCE((v_stats->>'monthPrints')::NUMERIC, 0);
      v_month_earnings := COALESCE((v_stats->>'monthEarnings')::NUMERIC, 0);
    END IF;

    v_total_prints := COALESCE((v_stats->>'totalPrints')::NUMERIC, 0);
    v_total_earnings := COALESCE((v_stats->>'totalEarnings')::NUMERIC, 0);
  END IF;

  -- Apply increments
  v_today_prints := v_today_prints + COALESCE(p_pages, 0);
  v_today_earnings := v_today_earnings + COALESCE(p_earnings, 0);
  v_month_prints := v_month_prints + COALESCE(p_pages, 0);
  v_month_earnings := v_month_earnings + COALESCE(p_earnings, 0);
  v_total_prints := v_total_prints + COALESCE(p_pages, 0);
  v_total_earnings := v_total_earnings + COALESCE(p_earnings, 0);

  UPDATE public.merchants
  SET
    stats = jsonb_build_object(
      'todayPrints', v_today_prints,
      'todayEarnings', v_today_earnings,
      'monthPrints', v_month_prints,
      'monthEarnings', v_month_earnings,
      'totalPrints', v_total_prints,
      'totalEarnings', v_total_earnings,
      'lastResetDate', v_today,
      'lastResetMonth', v_month
    ),
    updated_at = NOW()
  WHERE id = p_merchant_id;
END;
$$;

-- B. Confirm Payment & Atomically Update Stats (Single network call)
CREATE OR REPLACE FUNCTION public.confirm_payment_and_update_stats(
  p_job_id TEXT,
  p_merchant_id TEXT,
  p_cost NUMERIC,
  p_pages NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Mark job as completed and paid
  UPDATE public.print_jobs
  SET
    status = 'completed',
    payment_status = 'paid',
    paid_at = NOW(),
    completed_at = NOW()
  WHERE id = p_job_id;

  -- 2. Atomically increment merchant stats
  PERFORM public.increment_merchant_stats(p_merchant_id, p_pages, p_cost);
END;
$$;

-- C. Complete Print Job
CREATE OR REPLACE FUNCTION public.complete_print_job(
  p_job_id TEXT,
  p_merchant_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.print_jobs
  SET
    status = 'completed',
    completed_at = NOW()
  WHERE id = p_job_id AND merchant_id = p_merchant_id;
END;
$$;

-- 9. PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.merchants TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.print_jobs TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.keepalive TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_merchant_stats(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_payment_and_update_stats(TEXT, TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_print_job(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
