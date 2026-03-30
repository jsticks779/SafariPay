import { Router, Response } from 'express';
import pool from '../db/database';
import { SmsService } from '../services/sms_logger.service';
import { FXService } from '../services/fx.service';
import { auth, AuthRequest } from '../middleware/auth';
import { MpesaService } from '../services/mpesa.service';
import { UniversalGatewayService, MobileProvider } from '../services/universal_gateway.service';
import { EscrowService } from '../services/escrow.service';
import { BehavioralAnalyticsService } from '../services/behavioral_analytics.service';
import { OracleService } from '../services/oracle.service';
import { blockchainQueue } from '../services/queue.service';
import { BlockchainService } from '../services/blockchain.service';
import { sendTransactionSchema } from '../utils/validation';
import { IPFSService } from '../utils/ipfs';
import { CreditScoringEngine } from '../utils/creditScoring';
import { LoanService } from '../services/loan.service';
import { UnifiedTransferService, SendCategory } from '../services/transfer.service';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(auth);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
         s.name as sender_name, r.name as receiver_name
       FROM transactions t
       LEFT JOIN users s ON t.sender_id=s.id
       LEFT JOIN users r ON t.receiver_id=r.id
       WHERE t.sender_id=$1 OR t.receiver_id=$1
       ORDER BY t.created_at DESC LIMIT 100`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/send', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const validation = sendTransactionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message }); return;
    }
    const { receiver_phone, amount, description } = validation.data;

    await client.query('BEGIN');

    const sR = await client.query('SELECT * FROM users WHERE id=$1 AND is_active=true FOR UPDATE', [req.user!.id]);
    if (!sR.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Sender not found' }); return; }
    const sender = sR.rows[0];
    if (sender.is_blacklisted) { await client.query('ROLLBACK'); res.status(403).json({ error: 'Account blacklisted' }); return; }

    // 🛡️ KYC Fraud Prevention: Limit unverified accounts
    if (sender.trust_level === 'LOCKED') {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Verification Required', message: 'Please verify your phone number via OTP to start sending money.' });
      return;
    }
    if (sender.trust_level === 'LOW' && Number(amount) > 30000) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Verification Required', message: 'New/Unverified accounts are limited to TZS 30,000 per transfer. Verify your identity with a Selfie + ID to increase your limits.' });
      return;
    }

    const rR = await client.query('SELECT * FROM users WHERE phone=$1 AND is_active=true FOR UPDATE', [receiver_phone]);
    if (!rR.rows.length) { await client.query('ROLLBACK'); res.status(404).json({ error: 'Recipient not found' }); return; }
    const receiver = rR.rows[0];

    if (sender.id === receiver.id) { await client.query('ROLLBACK'); res.status(400).json({ error: 'Cannot send to yourself' }); return; }

    const isCross = sender.country !== receiver.country;
    let exchangeRate = 1.0;
    if (isCross) {
      exchangeRate = await OracleService.getFXRate(sender.currency, receiver.currency);
    }

    const feeRate = isCross ? 0.008 : 0.005;
    const fee = Math.round(+(amount) * feeRate);

    // Fee Credit (Reward Balance) Logic 
    // Fee Credit (Reward Balance) Logic 
    // Both balance and reward_balance are now standardized to TZS.
    let feeFromBalance = fee;
    let rewardUsageTZS = 0;

    const currentReward = Number(sender.reward_balance || 0);

    if (currentReward > 0) {
      rewardUsageTZS = Math.min(currentReward, fee);
      feeFromBalance = fee - rewardUsageTZS;
    }

    const total = Number(amount) + feeFromBalance;

    if (Number(sender.balance) < total) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `Insufficient balance. Need ${total.toLocaleString()} TZS (incl. fee)` }); return;
    }

    await client.query(
      'UPDATE users SET balance = balance - $1, reward_balance = reward_balance - $2, updated_at = NOW() WHERE id = $3',
      [total, rewardUsageTZS, sender.id]
    );

    // Auto-Deduction for Receiver (Debt Trap)
    const rawIncoming = Math.round(amount * exchangeRate);
    const amountAfterDebt = await LoanService.processAutoDeduction(receiver.id, rawIncoming, client);

    await client.query(
      'UPDATE users SET balance=balance+$1, last_balance_check=CASE WHEN (balance+$1) >= 2000 THEN last_balance_check ELSE NOW() END, updated_at=NOW() WHERE id=$2',
      [amountAfterDebt, receiver.id]
    );

    // Queue the blockchain anchor job
    const jobId = await blockchainQueue.add('anchor_transfer_send', {
      transactionId: undefined, // updated below
      amount,
      sender: sender.phone,
      receiver: receiver.phone,
      type: isCross ? 'cross_border' : 'local'
    });

    const { rows: txRows } = await client.query(
      `INSERT INTO transactions(sender_id,receiver_id,sender_phone,receiver_phone,amount,type,status,description,fee,exchange_rate,tx_hash)
       VALUES($1,$2,$3,$4,$5,$6,'completed',$7,$8,$9,$10) RETURNING *`,
      [sender.id, receiver.id, sender.phone, receiver.phone, amount, isCross ? 'cross_border' : 'local', description || 'Transfer', fee, exchangeRate, jobId]
    );

    // Update the queue job with the real DB tx ID for logs
    blockchainQueue.getStatus(jobId)!.data.transactionId = txRows[0].id;

    await client.query(
      `INSERT INTO credit_signals(user_id,signal_type,value,description) VALUES($1,'payment_sent',$2,'Sent payment')`,
      [sender.id, amount]
    );

    // Generate Decentralized IPFS Receipt
    const receiptData = {
      tx_id: txRows[0].id,
      sender: sender.phone,
      receiver: receiver_phone,
      amount,
      fee,
      currency: sender.currency,
      timestamp: new Date().toISOString()
    };
    const cid = await IPFSService.uploadJSON(receiptData);
    await client.query('UPDATE transactions SET metadata = jsonb_set(metadata, \'{ipfs_cid}\', $1) WHERE id=$2', [`"${cid}"`, txRows[0].id]);

    // Send SMS Notifications (Source of Truth)
    const senderMsg = `SafariPay: Sent ${amount} ${sender.currency} to ${receiver_phone}. Fee: ${fee}. New Balance: ${sender.balance - total} ${sender.currency}. IPFS: ${cid.slice(0, 10)}`;
    const receiverMsg = `SafariPay: Received ${amountAfterDebt} ${receiver.currency} from ${sender.phone}. New Balance: ${receiver.balance + amountAfterDebt} ${receiver.currency}. Type: ${isCross ? 'Cross-Border' : 'Transfer'}`;

    await SmsService.sendSms(sender.phone, senderMsg, 'TRANSACTION');
    await SmsService.sendSms(receiver.phone, receiverMsg, 'TRANSACTION');

    await client.query('COMMIT');

    // Behavioral Fraud Analysis
    const behavioralAnalysis = BehavioralAnalyticsService.analyzeTransaction(sender.id, +(amount), receiver.country, sender.country);
    if (behavioralAnalysis.flagged) {
      console.warn(`🚨 [SECURITY] Transaction flagged for user ${sender.id}. Risk Score: ${behavioralAnalysis.score}`);
      // In a real production app, we would block or require manual approval here
    }

    // Smart Routing
    const route = BehavioralAnalyticsService.getOptimalRoute(receiver.country);

    res.json({
      transaction: txRows[0],
      fee,
      tx_hash: jobId,
      ipfs_receipt: cid,
      network: route.network,
      behavioral_security: behavioralAnalysis,
      message: 'Transfer queued for blockchain anchoring!'
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.post('/transfer', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { recipient_wallet, amount, user_pin, description } = req.body;
    if (!recipient_wallet || !amount || !user_pin) {
      res.status(400).json({ error: 'recipient_wallet, amount, and user_pin are required' }); return;
    }

    await client.query('BEGIN');

    // 1. Get Sender & Recipient
    const sR = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user!.id]);
    const sender = sR.rows[0];
    const rR = await client.query('SELECT * FROM users WHERE wallet_address=$1 AND is_active=true FOR UPDATE', [recipient_wallet]);
    
    let receiver = rR.rows[0];
    let isExternalWallet = false;

    if (!receiver) {
        // Allow external Polygon addresses
        if (/^0x[a-fA-F0-9]{40}$/.test(recipient_wallet)) {
            isExternalWallet = true;
            receiver = { id: null, phone: 'External Wallet', name: 'External Address' };
        } else {
            await client.query('ROLLBACK');
            res.status(404).json({ error: 'Recipient wallet not found or invalid address' });
            return;
        }
    } else if (sender.id === receiver.id) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: 'Cannot transfer to yourself' });
        return;
    }

    // 2. Verify PIN
    const isPinValid = await bcrypt.compare(user_pin.toString(), sender.pin_hash);
    if (!isPinValid) { await client.query('ROLLBACK'); res.status(403).json({ error: 'Invalid security PIN' }); return; }

    // 2.5 Zero-Knowledge Private Key Recovery
    // Deliverable: Using decryptPrivateKey to recover the signing key for the transaction
    try {
      const { decryptPrivateKey } = require('../utils/cryptoUtils');
      const pk = decryptPrivateKey(sender.encrypted_private_key, user_pin.toString());
      // In a real production scenario, 'pk' would be used here to sign the Ethers.js transaction
      // console.log('Successfully recovered private key for transaction signing');
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Security alert: Signing key recovery failed. Data may be corrupted.' });
      return;
    }

    // 3. Fee Handling (0.5%)
    const fee = Math.round(+(amount) * 0.005);
    let feeFromBalance = fee;
    let rewardUsage = 0;
    if (+(sender.reward_balance) > 0) {
      rewardUsage = Math.min(+(sender.reward_balance), fee);
      feeFromBalance = fee - rewardUsage;
    }
    const totalToDeduct = +(amount) + feeFromBalance;

    if (+(sender.balance) < totalToDeduct) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `Insufficient balance. Need ${totalToDeduct.toLocaleString()} TZS` }); return;
    }

    // 4. Update Balances
    await client.query(
      'UPDATE users SET balance = balance - $1, reward_balance = reward_balance - $2 WHERE id = $3',
      [totalToDeduct, rewardUsage, sender.id]
    );
    if (!isExternalWallet) {
        await client.query('UPDATE users SET balance = balance + $1 WHERE id = $2', [amount, receiver.id]);
    }

    // 5. Blockchain & External Execution (Unified Service) 🚀
    const unifiedRes = await UnifiedTransferService.execute({
      userId: sender.id,
      category: 'safari',
      amount: Number(amount),
      recipient: recipient_wallet,
      description: description || 'Secure Transfer'
    });

    if (!unifiedRes.success) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: unifiedRes.message });
      return;
    }

    // 6. Record Transaction
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions(sender_id, receiver_id, sender_phone, receiver_phone, amount, type, status, description, fee, tx_hash)
       VALUES($1, $2, $3, $4, $5, 'local', 'completed', $6, $7, $8) RETURNING *`,
      [sender.id, receiver.id, sender.phone, receiver.phone, amount, description || 'Secure Transfer', fee, unifiedRes.txHash || 'PENDING']
    );

    await client.query('COMMIT');

    // 📢 Notify both via Simulated SMS (using Multi-Currency Localization)
    const localVal = await FXService.convertToLocalCurrency(Number(amount), sender.country);
    const formatted = FXService.formatLocal(localVal.amount, localVal.currency);

    await SmsService.sendSms(
      sender.phone,
      `You have sent ${formatted} to ${receiver.name}. Network: ${unifiedRes.network}`,
      'TRANSACTION'
    );

    if (!isExternalWallet) {
        const rLocal = await FXService.convertToLocalCurrency(Number(amount), receiver.country);
        const rFormatted = FXService.formatLocal(rLocal.amount, rLocal.currency);

        await SmsService.sendSms(
          receiver.phone,
          `You have received ${rFormatted} FROM ${sender.name}. Total balance: ${receiver.balance + Number(amount)} USDT. 🎉`,
          'TRANSACTION'
        );
    }

    res.json({
      success: true,
      transaction: txRows[0],
      tx_hash: unifiedRes.txHash,
      network: unifiedRes.network,
      message: unifiedRes.message
    });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT balance,currency FROM users WHERE id=$1', [req.user!.id]);
    res.json(rows[0] || { balance: 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/deposit', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, phone, provider } = req.body;
    if (!amount || amount <= 0) { res.status(400).json({ error: 'Valid amount required' }); return; }

    // Universal Gateway: Support Halopesa, Tigo, Airtel, etc. 🔌
    const gatewayRes = await UniversalGatewayService.handleDeposit(
      (provider as MobileProvider) || 'MPESA',
      phone || 'N/A',
      amount
    );

    if (!gatewayRes.success) { res.status(400).json({ error: `${provider} request failed: ${gatewayRes.message}` }); return; }

    // On-chain logic: Convert TZS to Stablecoin (USDT Preferred) 🪙
    const stableAmount = await OracleService.tzsToStable(amount);

    const { rows } = await pool.query('SELECT wallet_address FROM users WHERE id=$1', [req.user!.id]);
    
    // Auto-Liquidity Gateway: Mint/Transfer USDT to the user's blockchain wallet
    const txHash = await BlockchainService.fundWalletFromTreasury(rows[0].wallet_address, stableAmount);

    await pool.query(
      'INSERT INTO transactions(sender_id, receiver_id, amount, type, status, description, tx_hash) VALUES ($1,$1,$2,$3,$4,$5,$6)',
      [req.user!.id, amount, 'top_up', 'completed', `${provider || 'M-Pesa'} Deposit (${stableAmount.toFixed(2)} USDT)`, txHash]
    );

    // Auto-Deduction for Depositor (Debt Trap)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const amountAfterDebt = await LoanService.processAutoDeduction(req.user!.id, amount, client);

      await client.query(
        'UPDATE users SET balance = balance + $1, last_balance_check=CASE WHEN (balance+$1) >= 2000 THEN last_balance_check ELSE NOW() END WHERE id = $2',
        [amountAfterDebt, req.user!.id]
      );

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ message: 'Deposit successful', stableAmount, txHash });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/withdraw', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount, phone, provider, user_pin } = req.body;
    if (!amount || amount <= 0) { res.status(400).json({ error: 'Valid amount required' }); return; }
    if (!user_pin) { res.status(400).json({ error: 'Security PIN required to authorize withdrawal' }); return; }

    const gatewayRes = await UniversalGatewayService.handleWithdraw(
      provider || 'MPESA',
      phone || 'N/A',
      amount,
      req.user!.id,
      user_pin
    );

    res.json({ message: gatewayRes.message, txHash: gatewayRes.reference });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/withdraw/crypto', async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { wallet_address, network, amount_usdt, amount_tzs, user_pin } = req.body;
    if (!wallet_address || !amount_tzs || !user_pin) { res.status(400).json({ error: 'Missing required fields' }); return; }

    await client.query('BEGIN');
    const { rows: uR } = await client.query('SELECT phone, balance, pin_hash, encrypted_private_key FROM users WHERE id=$1 FOR UPDATE', [req.user!.id]);
    const user = uR[0];

    // 1. PIN verification
    const isPinValid = await bcrypt.compare(user_pin.toString(), user.pin_hash);
    if (!isPinValid) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Invalid security PIN' }); return;
    }

    // 2. AES Decrypt
    let privateKey;
    try {
      const { decryptPrivateKey } = require('../utils/cryptoUtils');
      privateKey = decryptPrivateKey(user.encrypted_private_key, user_pin.toString());
    } catch (e) {
      await client.query('ROLLBACK');
      res.status(403).json({ error: 'Security alert: Signing key recovery failed.' }); return;
    }

    // 3. Balance deduction plus fee
    const fee = Math.round(Number(amount_tzs) * 0.01);
    const totalDeduct = Number(amount_tzs) + fee;
    if (user.balance < totalDeduct) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Insufficient balance to cover withdrawal + 1% gas fee.' }); return;
    }

    await client.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalDeduct, req.user!.id]);

    // 4. On-chain execution via Unified Transfer service
    const unifiedRes = await UnifiedTransferService.execute({
      userId: req.user!.id,
      category: 'safari', // to trigger pure blockchain execution with a private key
      amount: amount_tzs,
      recipient: wallet_address,
      description: `Crypto Withdrawal to ${network}`,
      senderPrivateKey: privateKey
    });

    if (!unifiedRes.success) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: unifiedRes.message }); return;
    }

    // 5. TX Write
    const { rows: txRows } = await client.query(
      `INSERT INTO transactions(sender_id, receiver_phone, amount, type, status, description, fee, tx_hash)
       VALUES ($1, $2, $3, 'cross_border', 'completed', $4, $5, $6) RETURNING *`,
      [req.user!.id, wallet_address, amount_tzs, `Web3 Withdrawal: ${network}`, fee, unifiedRes.txHash || 'PENDING']
    );

    await client.query('COMMIT');
    res.json({ message: 'Crypto Withdrawal processed.', txHash: unifiedRes.txHash });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.post('/external', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { external_type, provider, receiver_id, amount, description, user_pin } = req.body;
    if (!receiver_id || !amount || +(amount) <= 0) {
      res.status(400).json({ error: 'receiver_id and amount required' }); return;
    }
    if (!user_pin) {
      res.status(400).json({ error: 'Security PIN required to authorize transfer' }); return;
    }

    const { rows: uR } = await pool.query('SELECT balance, phone, pin_hash, encrypted_private_key FROM users WHERE id=$1', [req.user!.id]);
    const user = uR[0];

    const isPinValid = await bcrypt.compare(user_pin.toString(), user.pin_hash);
    if (!isPinValid) {
      res.status(403).json({ error: 'Invalid security PIN' }); return;
    }

    // Decrypt AES private key to prove ownership locally
    try {
      const { decryptPrivateKey } = require('../utils/cryptoUtils');
      decryptPrivateKey(user.encrypted_private_key, user_pin.toString());
    } catch (e) {
      res.status(403).json({ error: 'Security alert: Signing key recovery failed.' }); return;
    }

    const fee = Math.round(+(amount) * 0.012); // 1.2% for external
    const total = +(amount) + fee;

    if (+(uR[0].balance) < total) {
      res.status(400).json({ error: 'Insufficient balance' }); return;
    }

    // Execution via Unified Gateway Service (Testnet/Mainnet Switch)
    const unifiedRes = await UnifiedTransferService.execute({
      userId: req.user!.id,
      category: external_type as SendCategory,
      amount: Number(amount),
      recipient: receiver_id,
      provider: provider,
      description: description
    });

    if (!unifiedRes.success) {
      res.status(500).json({ error: unifiedRes.message });
      return;
    }

    await pool.query('UPDATE users SET balance = balance - $1 WHERE id = $2', [total, req.user!.id]);

    const { rows: txRows } = await pool.query(
      `INSERT INTO transactions(sender_id, receiver_phone, amount, type, status, description, fee, tx_hash)
       VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7) RETURNING *`,
      [req.user!.id, receiver_id, amount, 'local', `Transfer to ${provider || 'External'}: ${description || ''}`, fee, unifiedRes.txHash || 'PENDING']
    );

    res.json({
      transaction: txRows[0],
      tx_hash: unifiedRes.txHash,
      network: unifiedRes.network,
      message: unifiedRes.message
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/**
 * 🔐 SECURE ESCROW ROUTES (P2P Trading)
 */
router.post('/escrow/hold', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { receiver_id, amount, description } = req.body;
    const result = await EscrowService.holdFunds(req.user!.id, receiver_id, amount, description || 'Escrow Hold');

    await SmsService.sendSms(req.user!.phone, `Escrow Secured: ${amount} TZS is now held. Receiver will get funds once you confirm release. Ref: ${result.txHash}`, 'TRANSACTION');

    res.json({ success: true, ...result, message: 'Funds held in escrow successfully' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/escrow/release', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transaction_id, user_pin } = req.body;
    if (!user_pin) {
      res.status(400).json({ error: 'Security PIN is required to release escrow' });
      return;
    }
    await EscrowService.releaseFunds(transaction_id, req.user!.id, user_pin);
    res.json({ success: true, message: 'Funds released from escrow to receiver' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/escrow/auto-release', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transaction_id } = req.body;
    const result = await EscrowService.verifyAndAutoRelease(transaction_id);
    res.json({ success: true, ...result, message: '🛡️ System Mediator: Funds auto-released after verification.' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/escrow/dispute', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transaction_id } = req.body;
    await EscrowService.disputeFunds(transaction_id);
    res.json({ success: true, message: 'Dispute raised successfully' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
