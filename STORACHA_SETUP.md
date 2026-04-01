# 🛡️ Storacha Setup Guide for SafariPay

This guide shows how to properly set up Storacha credentials for decentralized receipt storage on Filecoin.

---

## 🚨 Current Issue

Your current `.env` has:
```
W3_AGENT_KEY=did:key:z6MkkysifZRZpSrNhdVKbJxnR7qUJQ5xUz7TuF2otkFWy4xK  ❌ (This is a DID, not a Secret Key)
W3_PROOF=EaJlcm9vdHOAZ3ZlcnNpb24B...  ✅ (This is OK)
```

**Problem**: Storacha expects a Secret Key (starts with `M`), not a DID (starts with `did:key:`).

**Result**: Receipt uploads are failing silently, so transactions complete but users don't get receipt CIDs.

---

## ✅ How to Fix It

### Step 1: Go to Web3.Storage
1. Open https://app.web3.storage in your browser
2. Sign in with your email (or create an account if you don't have one)

### Step 2: Create an API Token
1. Click **Settings** in the left sidebar
2. Click **API Tokens** tab
3. Click **Create Token** button
4. Give it a name like `SafariPay-Prod` 
5. Click **Create API Token**

### Step 3: Copy Your Secret Key
You'll see a screen with:
```
🔒 SECRET KEY
M...your_secret_key_here...
```

⚠️ **Copy this entire Secret Key** - it starts with the letter `M` and is about 130 characters

### Step 4: Export the Delegation Proof (Optional but Recommended)
1. On the same API Token page, you should see a **Delegation** section
2. Look for an "Export as..." or "Download" button
3. Export as **base64** 
4. Copy the entire base64 string

### Step 5: Update Your .env

Replace your `backend/.env` with:

```env
# ... existing vars ...

# Storacha Credentials (from https://app.web3.storage)
W3_AGENT_KEY=M...your_130_character_secret_key_starting_with_M...
W3_PROOF=EaJlcm9vdHOAZ3...base64_encoded_delegation_proof...

# ... rest of your config ...
```

**Key validation**:
- ✅ `W3_AGENT_KEY` starts with `M` (exactly)
- ✅ `W3_PROOF` is a long base64 string (1000+ characters)
- ❌ NOT a DID (`did:key:...`)
- ❌ NOT a UUID

### Step 6: Restart Backend
```bash
cd backend
npm run dev
# or
yarn dev
```

---

## 🧪 Test Receipt Upload

Once restarted, the backend logs should show:
```
✅ Key format: Secret Key ✅
✅ Storacha client ready with delegation
✅ Receipt stored! CID: bafy2bzaced...
   🔗 View at: https://w3s.link/ipfs/bafy2bzaced...
```

Now when you make a transaction:
1. Transaction completes ✅
2. Receipt uploads to Filecoin ✅
3. User gets receipt button with CID ✅
4. Click button → see receipt on w3s.link ✅

---

## 🆘 Troubleshooting

### Problem: "Key format: DID ❌"
**Solution**: You're still using a DID. Go back to Web3.Storage and get a **Secret Key** (not the DID).

### Problem: "Missing W3_PROOF"
**Solution**: Both keys are required. Export the delegation proof from Web3.Storage API Token page.

### Problem: "Upload failed: 401"
**Solution**: Your Secret Key is invalid or revoked. Create a new one on Web3.Storage.

### Problem: "Upload failed: Network error"
**Solution**: Check your internet connection and verify Storacha service is online (https://status.storacha.network/).

### Problem: Transactions work but no receipt CID shows
**Check logs**:
```bash
# In another terminal, watch backend logs
tail -f /tmp/backend.log | grep -i storage
```

---

## 📊 Architecture

```
User sends transaction
         ↓
Backend processes (Polygon chain write)
         ↓
✅ Transaction successful → receipt JSON created
         ↓
Storacha client uploads receipt
         ↓
Receipt gets IPFS CID (bafy2bzaced...)
         ↓
User sees "View Receipt" button
         ↓
User clicks button → https://w3s.link/ipfs/bafy2bzaced...
```

---

## 🔗 Useful Links
- **Web3.Storage Console**: https://app.web3.storage
- **View Receipts**: https://w3s.link/ipfs/ (append CID)
- **Storacha Status**: https://status.storacha.network/
- **Filecoin Explorer**: https://filfox.info

---

## 📞 Support
If receipts still aren't uploading after following this guide:
1. Check backend logs: `grep -i "STORAGE\|upload\|cid" /tmp/backend.log`
2. Verify W3_AGENT_KEY starts with `M`
3. Try creating a fresh API token on Web3.Storage
4. Restart backend and test again

---

**Status**: Receipt uploads should now work! 🎉
