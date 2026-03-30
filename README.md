<div align="center">
  <h1>🦁 SafariPay</h1>
  <p><b>Africa's Decentralized Financial Platform</b></p>
  <p>Payments · Credit · Loans · Cross-Border · Identity</p>
</div>

---

## 📖 Executive Summary
**SafariPay** is an offline-first decentralized finance application designed specifically for the unbanked populations of East Africa and beyond. We solve financial exclusion by combining **high-throughput traditional backend rails, cutting-edge Web3 integrations (Polygon Amoy Testnet), and Behavioral Intelligence (Credit Scoring)**.

If you are a developer or an auditor looking at this repository, this README serves as the ultimate source of truth explaining how the entire architecture, flows, and structural decisions of SafariPay function.

---

## 🏗 System Architecture 

SafariPay utilizes a hybrid web2/web3 custodial architecture. Users interact with a familiar frontend, while the Node.js backend manages secure private key encryption, blockchain broadcasting, machine learning, and legacy mobile-money integration.

```mermaid
graph TD
    Client[React Frontend] <-->|REST API + JWT| BE[Node.js Express Backend]
    
    subgraph Core Backend Services
        BE --> Auth[Auth & KYC Service]
        BE --> UnifiedTx[Unified Transfer Service]
        BE --> Credit[Credit Scoring Engine]
        BE --> Loan[Micro-Loan Service]
        BE --> Escrow[Escrow & Dispute Service]
    end

    subgraph Data Layer
        Auth <--> DB[(PostgreSQL 15)]
        UnifiedTx <--> DB
        Credit <--> DB
    end

    subgraph Blockchain & Web3 (Polygon)
        UnifiedTx -->|1. Direct ERC-20| Polygon[Polygon Amoy Testnet]
        UnifiedTx -->|2. Guardian Anchor| Polygon
        UnifiedTx --> IPFS[IPFS Receipts]
    end

    subgraph Simulators & Providers
        BE --> SMS[SMS & USSD Simulator]
        BE --> MobileMoney[Universal Gateway: M-Pesa/Tigo]
        BE --> FX[FX / Oracle Service]
    end
```

---

## 🚀 The Tech Stack

### Frontend (React 18 + Vite)
- **Framework**: React 18 with TypeScript.
- **Routing**: React Router DOM (v6).
- **Styling**: Vanilla CSS (`index.css`) utilizing rich glassmorphism, responsive grids, and modern layout tokens. No heavy CSS frameworks.
- **State/State Management**: React Hooks (`useState`, `useEffect`, `useMemo`) combined with functional Contexts (`useAuth`, `useLanguage`).
- **Icons & Extras**: `lucide-react` for iconography, `react-hot-toast` for notifications, `qrcode.react` for decentralized payment codes.
- **Offline Reliability**: Custom `offlineQueue.ts` intercepts network failures and syncs actions when internet returns.

### Backend (Node.js + Express)
- **Framework**: Node.js (v22), Express.
- **Database**: PostgreSQL with standard `pg` driver (connection pooling).
- **Authentication**: JWT access tokens, `bcryptjs` for PIN and Password hashing.
- **Web3**: `ethers.js` (v6) for RPC communication with Polygon Amoy.
- **Background Jobs**: `bull` via Redis for async blockchain anchoring.
- **Validation**: `zod` for strict API payload verification.

---

## 📂 File Structure Directory

### Full Source Tree
```text
/safaripay
├── backend/                  # Node.js + Express + Ethers.js Backend
│   ├── package.json
│   ├── src/
│   │   ├── config/           # Network and Bridge configs
│   │   ├── controllers/      # REST API logic (auth, kyc, sms)
│   │   ├── db/               # PostgreSQL Setup, Seeders, & Schema Migrations
│   │   ├── middleware/       # JWT Auth and Multer uploads
│   │   ├── routes/           # Domain-Specific express routing
│   │   │   ├── auth.ts
│   │   │   ├── bridge.routes.ts
│   │   │   ├── loans.ts
│   │   │   ├── transactions.ts
│   │   │   ├── users.ts
│   │   │   ├── v1/transfer.routes.ts
│   │   │   └── wallet.routes.ts
│   │   ├── services/         # Core Business Logic Layer
│   │   │   ├── ai_engine.service.ts
│   │   │   ├── blockchain.service.ts    # Web3 Singleton
│   │   │   ├── transfer.service.ts      # 3-Tier Execution Matrix 
│   │   │   ├── escrow.service.ts        # P2P Hold logic
│   │   │   ├── kyc.service.ts
│   │   │   ├── loan.service.ts
│   │   │   ├── queue.service.ts
│   │   │   ├── sms_logger.service.ts
│   │   │   └── universal_gateway.service.ts # Mobile Money sim
│   │   └── utils/
│   │       ├── creditScoring.ts
│   │       ├── cryptoUtils.ts           # AES Custodial PIN wrapper
│   │       ├── ipfs.ts
│   │       ├── redis.ts
│   │       └── validation.ts            # Zod Validation schemas
│   └── index.ts              # Entry point
│
├── frontend/                 # React 18 + Vite PWA
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx           # Global Router & Offline Wrapper
│   │   ├── index.tsx         # Render entry point
│   │   ├── index.css         # Custom Glassmorphic CSS Engine
│   │   ├── components/       # Reusable UI forms and Nav
│   │   ├── hooks/            # Context Managers (useAuth, useLanguage)
│   │   ├── lib/
│   │   │   ├── api.ts              # Axios interceptors
│   │   │   └── offlineQueue.ts     # Offline-first caching logic
│   │   ├── pages/            # View Layer components
│   │   │   ├── CreditScore.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Loans.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── MerchantDashboard.tsx
│   │   │   ├── Onboarding.tsx        # KYC Flow
│   │   │   ├── PaymentSummary.tsx    # Decentralized Pay Engine
│   │   │   ├── ReceiveMoney.tsx      # Generates static QR
│   │   │   ├── RequestMoney.tsx      # Generates dynamic payment links
│   │   │   ├── SendGlobal.tsx
│   │   │   ├── SendMoney.tsx
│   │   │   ├── SmsDashboard.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── UssdSimulator.tsx     # Offline Simulator
│   │   │   └── Withdraw.tsx
│   │   └── services/         
│   │       └── kycService.ts
│
├── blockchain/               # Solidity Smart Contracts
│   └── contracts/
│       ├── CreditScoring.sol
│       ├── LendingPool.sol
│       ├── SafariPayPhoneRegistry.sol
│       ├── SafariPayWallet.sol
│       └── SafariSmartWallet.sol
│
└── database/                 # SQL database dumps
    └── safaripay_database.sql
```

---

## 🔄 Core Business Flows

### 1. Custodial Identity & Authentication
1. User registers with Phone Number and Password.
2. Backend generates a standard Polygon Wallet (Private Key + Public Address).
3. User sets a 4-digit numeric **PIN**.
4. The backend encrypts the Private Key using AES-256 with the PIN serving as the decryption core. The raw Private Key is *never* stored.
5. Result: A user's funds are safe even in a DB leak, as the PIN is required to unwrap the key for signing.

### 2. The 3-Tier Transfer Matrix (`UnifiedTransferService`)
When `POST /transactions/transfer` is fired, SafariPay uses a **Graceful Degradation** approach:
* **Tier 1 (Full On-Chain)**: If the user provides a PIN, we unwrap their key, sign an ERC-20 Mock USDT transaction, and broadcast directly to Polygon Amoy.
* **Tier 2 (Guardian Anchor)**: If direct transfer fails, the system executes the transfer off-chain in the Postgres DB, but uses a central Guardian Backend Wallet to anchor the receipt metadata to the blockchain.
* **Tier 3 (Pure Off-Chain)**: If the entire network is unreachable, it logs strictly to PostgreSQL to ensure no user is ever locked out of their money.

### 3. Decentralized Payment Requests (The `/pay` route)
1. **Creation**: A User goes to `RequestMoney.tsx` and generates a request.
2. **Deep Links**: We instantly formulate a deterministic link: `safaripay.app/pay?to=0xABC...&amount=10&token=USDT&network=amoy` and present it as a scannable QR Code.
3. **Fulfillment**: Anyone (even an external user scanning it) hits the `PaymentSummary.tsx` page. The page extracts the query params, queries the `BlockchainService` for network health and MATIC gas availability, prompts for PIN, and fires an on-chain Web3 transaction that settles in < 2 seconds.

### 4. Behavioral Credit Scoring & Loans (System Analytics Engine)
Instead of traditional collateral, SafariPay calculates a `300 - 850` score dynamically:
* Uses transaction frequency, cross-border volume, stable account longevity, and KYC Verified depth.
* Over 650 points unlocks the **"LOAN ELIGIBLE"** micro-loan badge directly in the Dashboard.
* **Debt-Trap Prevention**: If a user has an active loan, whenever they receive incoming cross-border or local transfers, the `LoanService` intercepts the event, automatically deducts the repayment fraction, and routes the remainder to their account seamlessly via a PostgreSQL `BEGIN/COMMIT` transaction.

### 5. Trust Builder & Escrow Security (`PENDING_ESCROW`)
To facilitate secure peer-to-peer commerce without intermediaries:
* **Hold Phase**: When a user purchases services, funds are securely deducted but locked in a `PENDING_ESCROW` status preventing seller access.
* **Secure Release**: The buyer triggers `escrow/release`. Instead of a basic API call, SafariPay enforces a robust validation check by hashing the user's 4-digit PIN on the backend, testing it against their `pin_hash`, and using it to decrypt their `encrypted_private_key`—essentially generating a Web3 signature before settling funds to the seller.
* **Dispute Escalation**: Transacting users can immediately freeze the operation via `/escrow/dispute` for admin intervention.

### 6. Auto-Liquidity Gateway (Fiat-to-USDT Wrapping)
SafariPay operates as a stablecoin-first ecosystem, gracefully abstracting Web3 complexities:
* **Inbound Flow (Deposits)**: When a user tops up their account via standard Mobile Money rails (e.g. M-Pesa), the system automatically triggers the `BlockchainService` and utilizes the platform's central Treasury (Guardian) Wallet to mint/transfer the equivalent value of USDT stablecoins directly to the user's on-chain `wallet_address`.
* **Outbound Flow (Off-Ramping)**: When a user withdraws funds globally, the `UniversalGatewayService` parses their phone number prefix to detect the destination country code (e.g., `+254` for Kenya, `+255` for Tanzania). It then queries the `FXService` for real-time live exchange rates, wraps the required Local Currency to USDT equivalents, applies a 1% structural fee, and triggers a Polygon Burn/Return sequence back to the Treasury.

### 7. Administrative Control Portal (`/admin`)
An entirely sequestered operational interface exists natively within the primary React application:
* **Isolated JWT Architecture**: The backend strictly guards the `/admin` REST endpoints manually by issuing a specialized `{ role: 'admin' }` JWT token upon secret validation. This deliberately avoids writing traditional administrative profiles to the PostgreSQL `users` table, which prevents `UUID` caching/casting collisions and guarantees pristine system ledgers.
* **Component Encapsulation**: Upon a successful validation, the frontend React router permanently bypasses all standard UI component trees, locking the user strictly onto the **Data Analytics Dashboard**.
* **Global FX Forcing**: Contains an economic override matrix forcing real-time updates directly to the PostgreSQL database (`exchange_rates` mechanics) which dynamically re-balances Consumer Wallets engaging the liquidity pool bridge instantly without code restarts.

---

## 💸 Supported Payment & Withdrawal Flows

1. **Send to SafariPay user**
   * **Fields**: `receiver_phone`, `amount`, `pin` (required) + `description` (optional).
   * **Backend**: Looks up receiver by phone, verifies PIN cryptographically (`bcrypt.compare`), decrypts the sender's private key via AES-256, and executes the 3-Tier Transfer Matrix. Standardizes DB deduction using `BEGIN/COMMIT`. Returns `tx_hash`.

2. **Send to mobile money**
   * **Fields**: `receiver_phone`, `provider` (auto-detected), `amount`, `pin`.
   * **Backend**: Detects country from phone prefix, calls `UniversalGatewayService`, charges a 1% network fee, debits PostgreSQL, and simulates pushing to Africa is Talking / M-Pesa B2C B2B API pipelines.

3. **Send to bank account**
   * **Fields**: `bank_name`, `account_number`, `account_holder_name`, `amount`, `pin`.
   * **Backend**: Routes through a simulated Flutterwave/Cellulant aggregator for local bank integration. Displays an explicit "1-2 business days" settlement message internally to warn users about traditional banking rail latencies versus Web3 rails.

4. **Send global (cross-border)**
   * **Fields**: `recipient_phone`, `recipient_country`, `amount`, `pin`.
   * **Backend**: The FX Oracle converts local fiat to equivalent USDT balances natively, applies a fixed 0.8% FX Margin over baseline Oracle rates, utilizes `Ethers.js` to sign the ERC-20 stablecoin outbound on Polygon Amoy, and settles near-instantly (~2 seconds).

5. **Deposit via mobile money**
   * **Fields**: `phone`, `provider`, `amount`.
   * **Backend**: Generates an M-Pesa STK Push sequence (No PIN required from SafariPay, the user dials PIN into their home carrier interface). Credit strikes PostgreSQL, while the central Guardian Treasury programmatically mints `USDT` equivalents direct to the user's `wallet_address`.

6. **Withdraw to mobile money**
   * **Fields**: `phone`, `provider`, `amount`, `pin`.
   * **Backend**: Performs PIN decryption/verification, deducts outbound balance alongside a 1% structural fee directly in Postgres, liquidates equivalent `USDT` to Treasury on Polygon via a Burn, and calls the appropriate B2C API for mobile cash injection.

7. **Withdraw to bank**
   * **Fields**: `bank_name`, `account_number`, `amount`, `pin`.
   * **Backend**: Hits Flutterwave payout APIs with webhook listeners to update status from `PENDING_BANK` to `COMPLETED` when cleared. Auto-reverses funds locally if the clearinghouse rejects the routing.

8. **Withdraw directly to Web3 Crypto Wallet**
   * **Fields**: `wallet_address`, `network`, `amount_usdt`, `pin`.
   * **Backend**: Decrypts user AES keys to fire a raw ERC-20 protocol transfer payload straight to the blockchain via Ethers.js. UI rigorously validates against standard `0x...` hex wallet structures and explicitly warns users on the irreversibility of this action.

---

## 📊 Database Schema Summary

The application heavily utilizes PostgreSQL guarantees (ACID) precision math.
* **`users`**: Stores `phone`, `password_hash`, `pin_hash`, `balance`, `wallet_address`, `encrypted_private_key`, `trust_level` (Locked, Low, Verified), `kyc_status`.
* **`transactions`**: The ledger. Standardized to double-entry properties. Stores `sender_id`, `receiver_id`, `amount`, `fee`, `type`, and `tx_hash` (the Polygon anchor).
* **`loans`**: Loan principals, interest_rate, status (active/paid).
* **`payment_requests`**: Temporary generation tracking for invoice state.

---

## 💻 Running the Application

### 1. Requirements
* Node.js v20+
* PostgreSQL 15+ (Running on localhost:5432)
* Alchemy API Key (For Polygon Amoy access)

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env to add your Postgres credentials and Alchemy Key
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:3000`.

---

## 🧠 Development Instructions
If you are viewing this repository to implement features:
1. Always check the routing logic in `App.tsx` and the respective backend Express routes before creating new logic.
2. **Never** trust floating-point math for money. Use integer rounding (`Math.round`) or `DECIMAL` mapping when pushing to the backend.
3. The visual standard is high. Always use `css` custom variables like `var(--bg-dark)`, `var(--primary)`, and the pre-existing glassmorphic utility classes (`card-glow`, `glass-panel`). Do not use Tailwind.
4. If testing Web3 locally, be aware that calls to `api.post('/transactions/transfer')` expect the User's PIN to unwrap the AES-encrypted private keys. 

<div align="center">
  <br />
  <p><b>SafariPay</b> — Your money. Your identity. Your future.</p>
</div>
