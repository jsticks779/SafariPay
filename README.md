<div align="center">
  <img src="logo.png" alt="SafariPay" width="120px" />
  <h1>🦁 SafariPay</h1>
  <p><b>Africa's Unified Digital Economy on Polygon & Storacha</b></p>
  <p>Instant P2P Payments · Decentralized Credit · Micro-Loans · Mobile Money Ramps</p>

  [![Hackathon](https://img.shields.io/badge/Hackathon-protocollab-blueviolet?style=for-the-badge)](https://protocol.ai)
  [![Polygon](https://img.shields.io/badge/Network-Polygon-8247E5?style=for-the-badge&logo=polygon)](https://polygon.technology)
  [![Storacha](https://img.shields.io/badge/Storage-Storacha-0090FF?style=for-the-badge)](https://storacha.network)
</div>

---

## 📖 Overview
**SafariPay** is a next-generation financial infrastructure built to bridge Africa's mobile money economy with Web3. Born from the hackathon to solve real fintech challenges, we deliver:
- **Lightning-fast payments** via Polygon Amoy Testnet (2-second settlement)
- **Permanent receipt storage** on Filecoin through Storacha
- **Verifiable credit scores** anchored on-chain
- **Full offline-first architecture** for low-connectivity regions

The result: unbanked Africans can send money instantly, build cryptographic credit histories, and access microloans—all with just a mobile phone.

---

## ⚡ Key Features
- **Instant P2P Transfers (Polygon)**: Send money across borders in seconds with <1¢ fees using Polygon's Layer-2 scalability
- **Immutable Receipts (Storacha/Filecoin)**: Every transaction generates a permanent IPFS-backed receipt (CID). Verify any transaction's integrity independently
- **On-Chain Credit Scoring**: Real-time algorithm computes creditworthiness from transaction history, stored as verifiable on-chain data
- **Micro-Loan Engine**: Automated lending pools that unlock credit based on your transaction history—no bank required
- **Mobile Money Integration**: Bridge fiat ↔ crypto via M-Pesa, Tigo Pesa, and bank transfers
---

## 🏗 Architecture
```
┌─────────────────────────────────────────────────────────────┐
│              Mobile App (React Native / Web)                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│           Node.js Backend (TypeScript) + PostgreSQL          │
└──────┬──────────────────────┬──────────────────┬──────────────┘
       │                      │                  │
       ▼                      ▼                  ▼
┌─────────────┐      ┌──────────────┐    ┌─────────────────┐
│   Polygon   │      │  Storacha    │    │  Mobile Money   │
│   Amoy      │      │  / Filecoin  │    │  Gateways       │
│ (Payments)  │      │  (Storage)   │    │  (M-Pesa, etc)  │
└─────────────┘      └──────────────┘    └─────────────────┘
```

**Polygon Layer** (Execution): Smart contracts handle all payments, credit scoring, and loan disbursement via USDT on Amoy testnet (chainId: 80002).

**Storacha Layer** (Storage): Immutable transaction receipts stored on Filecoin via Storacha's Web3.Storage API. Each receipt gets a Content Identifier (CID) that users can verify independently.

**Mobile Gateway** (On-Ramps): M-Pesa, Tigo Pesa integration allows users to bridge fiat and stablecoins seamlessly.

---

## 🛠 Tech Stack
| Layer | Technology |
|-------|-----------|
| **Blockchain** | Polygon Amoy Testnet (L2), future Starknet support |
| **Storage** | Storacha (Web3.Storage v2) + Filecoin |
| **Backend** | Node.js/Express, TypeScript, PostgreSQL |
| **Frontend** | React 18, Vite, Mobile-first design |
| **Offline** | LocalForage, service workers for low-connectivity |
| **Security** | JWT, Lit Protocol for key management |

---

## 🚀 Quick Start

### Prerequisites
- Node.js v20+, PostgreSQL 15+
- Polygon RPC key (Alchemy recommended)
- Storacha credentials (Web3.Storage)

### Setup
```bash
# Clone and install
git clone https://github.com/yourusername/SafariPay.git
cd SafariPay

# Backend
cd backend
npm install
cp .env.example .env
# Update .env with credentials
npm run dev

# Frontend (in new terminal)
cd ../frontend
npm install
npm start
```

### Environment Variables
```env
# Polygon
ALCHEMY_API_KEY=your_alchemy_key
USDT_CONTRACT_ADDRESS_TESTNET=0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582

# Storacha (Get from app.web3.storage)
W3_AGENT_KEY=your_web3_storage_secret
W3_PROOF=your_delegation_proof_base64

# App
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost/safaripay
JWT_SECRET=your_jwt_secret
```

---

## 🎯 How It Works

### Transaction Flow
1. **User sends money** → Backend validates via mobile number lookup
2. **Execute on Polygon** → Smart contract transfers USDT in 2-3 seconds
3. **Store receipt** → Transaction JSON uploaded to Filecoin via Storacha, get CID
4. **User verifies** → Click "View Receipt" to access immutable proof via IPFS
5. **Score updates** → Transaction counted toward on-chain credit score

### Example Response
```json
{
  "success": true,
  "txHash": "0x1234...",
  "ipfsCid": "bafy2bzaced...",
  "receiptLink": "https://w3s.link/ipfs/bafy2bzaced...",
  "explorerUrl": "https://amoy.polygonscan.com/tx/0x1234..."
}
```

---

## 🔮 Blockchain Integration
- **Polygon Amoy**: Primary testnet for fast, cheap P2P payments
- **Starknet**: Cairo contracts for privacy-enhanced future payments
- **Filecoin**: Permanent settlement layer for audit trails

---

## 🏆 Hackathon Status
✅ **Complete MVP** with all core features  
✅ **Production Polygon integration** (tested on Amoy)  
✅ **Storacha receipts** anchored to Filecoin  
✅ **Offline-first** for poor connectivity  
✅ **Mobile UI** optimized for sub-$50 phones  

**Ready for**: Protocol Labs, Web3 judges, fintech evaluators

---

<div align="center">
  <p><b>SafariPay — Your Money. Your Rules. On Chain.</b></p>
  <p>Built for 500M+ unbanked Africans | Hackathon Ready 🚀</p>
</div>
