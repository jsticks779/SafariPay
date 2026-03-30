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
  encrypted_private_key TEXT,
  ipfs_cid      VARCHAR(255),
  balance       DECIMAL(18,2) NOT NULL DEFAULT 10000.00,
  credit_score  INTEGER NOT NULL DEFAULT 320 CHECK (credit_score BETWEEN 300 AND 850),
  country       VARCHAR(5) NOT NULL DEFAULT 'TZ',
  currency      VARCHAR(5) NOT NULL DEFAULT 'TZS',
  account_type  VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal','merchant','agent')),
  kyc_status    VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (kyc_status IN ('pending','verified','rejected')),
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
  type            VARCHAR(30) NOT NULL CHECK (type IN ('local','cross_border','loan_disbursement','loan_repayment','top_up')),
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
-- DEMO DATA
-- PIN for all demo users is: 1234
-- Hash of '1234' with bcrypt rounds=10
-- ============================================================

INSERT INTO users (phone, name, pin_hash, did, balance, credit_score, country, currency, account_type, kyc_status) VALUES
(
  '+255712345678',
  'Amina Hassan',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:255712345678:001',
  125000.00, 720, 'TZ', 'TZS', 'personal', 'verified'
),
(
  '+255787654321',
  'John Makwela',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:255787654321:002',
  45000.00, 580, 'TZ', 'TZS', 'merchant', 'verified'
),
(
  '+254700123456',
  'Grace Wanjiku',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:254700123456:003',
  890000.00, 810, 'KE', 'KES', 'personal', 'verified'
),
(
  '+447911123456',
  'David Osei',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:447911123456:004',
  2450000.00, 760, 'GB', 'GBP', 'personal', 'verified'
),
(
  '+255700000001',
  'Fatuma Mwangi',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:255700000001:005',
  8500.00, 420, 'TZ', 'TZS', 'personal', 'verified'
),
(
  '+256700123456',
  'Samuel Okello',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'did:safaripay:256700123456:006',
  67000.00, 640, 'UG', 'UGX', 'merchant', 'verified'
);

-- ============================================================
-- DEMO TRANSACTIONS
-- ============================================================
INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 50000, 'TZS', 'local', 'completed',
  'Market supplies payment', 250,
  '0xabc123def456789012345678901234567890abcd', NOW() - INTERVAL '2 hours'
FROM users s, users r WHERE s.phone='+255712345678' AND r.phone='+255787654321';

INSERT INTO merchant_profiles (user_id, business_name, location)
SELECT id, 'Makwela Hardware Store', 'Kariakoo, Dar es Salaam'
FROM users WHERE phone='+255787654321';

INSERT INTO merchant_profiles (user_id, business_name, location)
SELECT id, 'Okello Electronics', 'Kampala Central'
FROM users WHERE phone='+256700123456';

INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 15000, 'TZS', 'local', 'completed',
  'Food payment', 75,
  '0xdef456abc789012345678901234567890abcdef12', NOW() - INTERVAL '5 hours'
FROM users s, users r WHERE s.phone='+255787654321' AND r.phone='+255712345678';

INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, exchange_rate, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 200000, 'TZS', 'cross_border', 'completed',
  'Family support from Kenya', 1600, 19.23000000,
  '0x789012abcdef345678901234567890abcdef3456', NOW() - INTERVAL '1 day'
FROM users s, users r WHERE s.phone='+254700123456' AND r.phone='+255712345678';

INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, exchange_rate, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 500000, 'TZS', 'cross_border', 'completed',
  'Diaspora remittance from UK', 4000, 3150.00000000,
  '0x345678901234abcdef567890abcdef1234567890', NOW() - INTERVAL '3 days'
FROM users s, users r WHERE s.phone='+447911123456' AND r.phone='+255712345678';

INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 30000, 'TZS', 'local', 'completed',
  'Airtime purchase', 150,
  '0x901234567890abcdef123456789012345678abcd', NOW() - INTERVAL '4 days'
FROM users s, users r WHERE s.phone='+255712345678' AND r.phone='+255787654321';

INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, tx_hash, created_at)
SELECT
  s.id, r.id, s.phone, r.phone, 75000, 'TZS', 'local', 'completed',
  'Bodaboda spare parts', 375,
  '0xef1234567890abcdef1234567890abcdef12345', NOW() - INTERVAL '6 days'
FROM users s, users r WHERE s.phone='+255712345678' AND r.phone='+255700000001';

-- ============================================================
-- DEMO LOAN for John Makwela
-- ============================================================
INSERT INTO loans (user_id, amount, interest_rate, duration_days, status, purpose, due_date, paid_amount, contract_address, created_at)
SELECT
  id, 100000.00, 5.00, 30, 'active', 'Stock purchase for business',
  NOW() + INTERVAL '15 days', 0.00,
  '0x1234567890abcdef1234567890abcdef12345678',
  NOW() - INTERVAL '15 days'
FROM users WHERE phone = '+255787654321';

-- Loan disbursement transaction for John
INSERT INTO transactions (sender_id, receiver_id, sender_phone, receiver_phone, amount, currency, type, status, description, fee, tx_hash, created_at)
SELECT
  id, id, phone, phone, 100000, 'TZS', 'loan_disbursement', 'completed',
  'Loan disbursed: Stock purchase for business', 0,
  '0xabcdef1234567890abcdef1234567890abcdef12', NOW() - INTERVAL '15 days'
FROM users WHERE phone = '+255787654321';

-- Repaid loan for Amina (shows history)
INSERT INTO loans (user_id, amount, interest_rate, duration_days, status, purpose, due_date, paid_amount, contract_address, created_at)
SELECT
  id, 50000.00, 4.50, 30, 'repaid', 'Farming inputs',
  NOW() - INTERVAL '5 days', 52250.00,
  '0x9876543210fedcba9876543210fedcba98765432',
  NOW() - INTERVAL '35 days'
FROM users WHERE phone = '+255712345678';

-- ============================================================
-- DEMO CREDIT SIGNALS
-- ============================================================
INSERT INTO credit_signals (user_id, signal_type, value, description, recorded_at)
SELECT id, 'payment_sent', 50000, 'Regular payment sent', NOW() - INTERVAL '2 hours'
FROM users WHERE phone = '+255712345678';

INSERT INTO credit_signals (user_id, signal_type, value, description, recorded_at)
SELECT id, 'payment_sent', 30000, 'Regular payment sent', NOW() - INTERVAL '4 days'
FROM users WHERE phone = '+255712345678';

INSERT INTO credit_signals (user_id, signal_type, value, description, recorded_at)
SELECT id, 'loan_repaid', 52250, 'Full loan repayment — credit improved', NOW() - INTERVAL '5 days'
FROM users WHERE phone = '+255712345678';

INSERT INTO credit_signals (user_id, signal_type, value, description, recorded_at)
SELECT id, 'payment_sent', 15000, 'Regular payment sent', NOW() - INTERVAL '5 hours'
FROM users WHERE phone = '+255787654321';

-- ============================================================
-- DEMO CONTACTS
-- ============================================================
INSERT INTO contacts (owner_id, contact_id, nickname)
SELECT o.id, c.id, 'John (Business)'
FROM users o, users c WHERE o.phone='+255712345678' AND c.phone='+255787654321';

INSERT INTO contacts (owner_id, contact_id, nickname)
SELECT o.id, c.id, 'Grace Kenya'
FROM users o, users c WHERE o.phone='+255712345678' AND c.phone='+254700123456';

-- ============================================================
-- VERIFY
-- ============================================================
SELECT 'users' as tbl, COUNT(*) as rows FROM users
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'loans', COUNT(*) FROM loans
UNION ALL SELECT 'credit_signals', COUNT(*) FROM credit_signals;

SELECT '✅ SafariPay database ready! Login: +255712345678 / PIN: 1234' as status;
