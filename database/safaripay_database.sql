-- ============================================================
--  SafariPay — Complete Database Setup
--  Run this file in PostgreSQL to set up all tables + demo data
--
--  HOW TO IMPORT:
--    psql -U safaripay -d safaripay -f safaripay_database.sql
--
--  Or via pgAdmin: Tools > Query Tool > Open file > Run
-- ============================================================

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- DROP existing tables (for clean re-import)
-- ============================================================
DROP TABLE IF EXISTS credit_signals CASCADE;
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS merchant_profiles CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS system_messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(25) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(120) UNIQUE,
  id_type       VARCHAR(50) DEFAULT 'NIDA', 
  id_number     VARCHAR(50),
  nida_number   VARCHAR(20) UNIQUE, -- Deprecated in favor of id_number but kept for compatibility
  pin_hash      VARCHAR(255) NOT NULL,
  did           VARCHAR(255) UNIQUE,
  wallet_address VARCHAR(100),
  eoa_address    VARCHAR(100),
  encrypted_private_key TEXT,
  encrypted_mnemonic TEXT,
  ipfs_cid      VARCHAR(255),
  balance       DECIMAL(18,2) NOT NULL DEFAULT 10000.00,
  reward_balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  credit_score  INTEGER NOT NULL DEFAULT 320 CHECK (credit_score BETWEEN 300 AND 850),
  country       VARCHAR(5) NOT NULL DEFAULT 'TZ',
  currency      VARCHAR(5) NOT NULL DEFAULT 'TZS',
  account_type  VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal','merchant','agent')),
  kyc_status    VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (kyc_status IN ('pending','verified','rejected')),
  trust_level   VARCHAR(20) NOT NULL DEFAULT 'STARTER',
  is_phone_verified BOOLEAN NOT NULL DEFAULT true,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_country ON users(country);

-- ============================================================
-- TABLE: transactions
-- ============================================================
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  receiver_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_phone    VARCHAR(25),
  receiver_phone  VARCHAR(25),
  amount          DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  currency        VARCHAR(5) NOT NULL DEFAULT 'TZS',
  type            VARCHAR(30) NOT NULL CHECK (type IN ('local','cross_border','loan_disbursement','loan_repayment','top_up','deposit','withdrawal')),
  status          VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','failed','reversed')),
  description     VARCHAR(255),
  tx_hash         VARCHAR(100),
  fee             DECIMAL(18,2) NOT NULL DEFAULT 0,
  exchange_rate   DECIMAL(14,8) DEFAULT 1.00000000,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_sender ON transactions(sender_id, created_at DESC);
CREATE INDEX idx_transactions_receiver ON transactions(receiver_id, created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ============================================================
-- TABLE: loans
-- ============================================================
CREATE TABLE loans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount            DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  interest_rate     DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  duration_days     INTEGER NOT NULL DEFAULT 30 CHECK (duration_days > 0),
  status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','repaid','defaulted','cancelled')),
  purpose           VARCHAR(120),
  due_date          TIMESTAMPTZ NOT NULL,
  paid_amount       DECIMAL(18,2) NOT NULL DEFAULT 0,
  contract_address  VARCHAR(100),
  on_chain_id       VARCHAR(100),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_loans_user ON loans(user_id, created_at DESC);
CREATE INDEX idx_loans_status ON loans(status);

-- ============================================================
-- TABLE: loan_repayments
-- ============================================================
CREATE TABLE loan_repayments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id     UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repayments_loan ON loan_repayments(loan_id);

-- ============================================================
-- TABLE: credit_signals
-- ============================================================
CREATE TABLE credit_signals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type   VARCHAR(60) NOT NULL,
  value         DECIMAL(18,2),
  description   VARCHAR(180),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_user ON credit_signals(user_id, recorded_at DESC);

-- ============================================================
-- TABLE: merchant_profiles
-- ============================================================
CREATE TABLE merchant_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  business_name VARCHAR(120) NOT NULL,
  location      VARCHAR(255) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: contacts
-- ============================================================
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname    VARCHAR(60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(owner_id, contact_id)
);

-- ============================================================
-- TABLE: system_messages
-- ============================================================
CREATE TABLE system_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_phone   VARCHAR(25) NOT NULL,
  message           TEXT NOT NULL,
  msg_type          VARCHAR(25) NOT NULL, -- TRANSACTION, OTP, STK_PUSH
  channel           VARCHAR(10) NOT NULL, -- SMS, EMAIL, PUSH
  sender            VARCHAR(50) DEFAULT 'SAFARIPAY',
  amount            DECIMAL(18,2),
  provider          VARCHAR(50),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_phone ON system_messages(recipient_phone, created_at DESC);

-- ============================================================
-- TABLE: exchange_rates
-- ============================================================
CREATE TABLE exchange_rates (
  base_currency     VARCHAR(5) NOT NULL DEFAULT 'USD',
  target_currency   VARCHAR(5) NOT NULL,
  rate              DECIMAL(20,8) NOT NULL,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(base_currency, target_currency)
);


-- ============================================================
-- FUNCTION: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'users' as tbl, COUNT(*) as rows FROM users
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'loans', COUNT(*) FROM loans
UNION ALL SELECT 'credit_signals', COUNT(*) FROM credit_signals;

SELECT '✅ SafariPay database ready! Start fresh by registering a new account.' as status;

