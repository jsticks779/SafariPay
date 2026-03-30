import { Router, Response } from 'express';
import { ethers } from 'ethers';
import pool from '../db/database';
import { auth, AuthRequest } from '../middleware/auth';
import { WalletService } from '../services/wallet.service';
import { BlockchainService } from '../services/blockchain.service';
import { AutoConversionService } from '../services/autoconversion.service';
import { FXService } from '../services/fx.service';

const router = Router();
router.use(auth);

router.get('/balance', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query('SELECT wallet_address, balance as tzs_balance, reward_balance as usdt_bonus FROM users WHERE id=$1', [req.user!.id]);
    if (!rows.length) { res.status(404).json({ error: 'User not found' }); return; }

    const user = rows[0];
    const fullBal = await WalletService.getFullBalance(user.wallet_address, Number(user.tzs_balance));

    // Total USDT = On-chain USDT + Off-chain reward balance (Converted to USDT)
    const totalUsdt = Number(fullBal.onChain.usdt) + (Number(user.usdt_bonus) / 2500);

    res.json({ usdt_balance: totalUsdt, onChain: fullBal.onChain });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/dashboard', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user!.id;
    const [uR, txR, lR, mR] = await Promise.all([
      pool.query('SELECT id,phone,name,balance,reward_balance,credit_score,country,currency,kyc_status,did,wallet_address FROM users WHERE id=$1', [id]),
      pool.query(
        `SELECT t.*,s.name as sender_name,r.name as receiver_name
         FROM transactions t
         LEFT JOIN users s ON t.sender_id=s.id
         LEFT JOIN users r ON t.receiver_id=r.id
         WHERE t.sender_id=$1 OR t.receiver_id=$1
         ORDER BY t.created_at DESC LIMIT 8`, [id]
      ),
      pool.query("SELECT * FROM loans WHERE user_id=$1 AND status='active' LIMIT 1", [id]),
      pool.query(
        `SELECT
           COALESCE(SUM(CASE WHEN sender_id=$1 AND type!='loan_disbursement' THEN amount ELSE 0 END),0) as sent,
           COALESCE(SUM(CASE WHEN receiver_id=$1 AND type!='loan_repayment' AND description NOT LIKE '%Welcome Fee Credit%' THEN amount ELSE 0 END),0) as received,
           COUNT(*) as total_txns
         FROM transactions
         WHERE (sender_id=$1 OR receiver_id=$1) AND created_at>=NOW()-INTERVAL '30 days'`, [id]
      ),
    ]);
    const user = uR.rows[0];
    const fullBal = await WalletService.getFullBalance(user.wallet_address, Number(user.balance));

    // Inject on-chain data into user object for frontend
    user.onChain = fullBal.onChain;

    const rewardRate = await FXService.getLiveRate(user.currency || 'TZS');
    const offChainUsdt = Number(user.reward_balance || 0) / rewardRate;
    user.total_usdt = Number(fullBal.onChain.usdt || 0) + offChainUsdt;

    if (user.wallet_address) {
      AutoConversionService.sweepToUsdt(user.wallet_address)
        .catch(err => console.error('Auto-sweep failed:', err.message));
    }

    // 🌍 [Localization] Contextual Balance for User
    const local = await FXService.convertToLocalCurrency(user.total_usdt, user.country);
    user.local_balance = FXService.formatLocal(local.amount, local.currency);
    user.fx_rate = local.rate;

    res.json({
      user,
      recent_transactions: txR.rows,
      active_loan: lR.rows[0] || null,
      monthly_stats: mR.rows[0],
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/score', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.user!.id;
    const [uR, sigR, txC, lC] = await Promise.all([
      pool.query('SELECT credit_score,created_at FROM users WHERE id=$1', [id]),
      pool.query('SELECT * FROM credit_signals WHERE user_id=$1 ORDER BY recorded_at DESC LIMIT 15', [id]),
      pool.query("SELECT COUNT(*) FROM transactions WHERE (sender_id=$1 OR receiver_id=$1) AND status='completed'", [id]),
      pool.query("SELECT COUNT(*) FROM loans WHERE user_id=$1 AND status='repaid'", [id]),
    ]);
    const { credit_score: score, country, currency } = uR.rows[0];
    const grade = score >= 750 ? 'Excellent' : score >= 700 ? 'Very Good' : score >= 650 ? 'Good' : score >= 600 ? 'Fair' : score >= 500 ? 'Poor' : 'Building';

    // 🌍 [Localization] Global 2.00 USDT
    const starterAmount = FXService.getStarterLimit(currency || 'TZS');
    const usdtBase = 2.00;

    const baseMax = score >= 700 ? (starterAmount * 100) : score >= 600 ? (starterAmount * 40) : score >= 500 ? (starterAmount * 20) : score >= 400 ? (starterAmount * 10) : score >= 350 ? (starterAmount * 4) : starterAmount;

    res.json({
      score, grade,
      max_loan: baseMax,
      interest_rate: score >= 700 ? 3.5 : score >= 600 ? 4.5 : score >= 500 ? 5.5 : 7.0,
      signals: sigR.rows,
      stats: { transactions: parseInt(txC.rows[0].count), loans_repaid: parseInt(lC.rows[0].count), member_since: uR.rows[0].created_at },
      factors: [
        { name: 'Payment history', weight: 35, score: score >= 600 ? 'Good' : 'Building' },
        { name: 'Transaction volume', weight: 25, score: parseInt(txC.rows[0].count) > 5 ? 'Good' : 'Building' },
        { name: 'Loan repayment', weight: 20, score: parseInt(lC.rows[0].count) > 0 ? 'Excellent' : 'No history' },
        { name: 'Account age', weight: 20, score: 'Building' },
      ]
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/lookup', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone } = req.query;
    if (!phone) { res.status(400).json({ error: 'phone required' }); return; }
    const { rows } = await pool.query(
      'SELECT id, phone, name, wallet_address, country, currency FROM users WHERE phone=$1 AND id!=$2 AND is_active=true',
      [phone, req.user!.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'User not found on SafariPay' }); return; }
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/favorites', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.nickname, u.name, u.phone, u.wallet_address, u.country, u.currency 
       FROM favorites f
       JOIN users u ON f.favorite_id = u.id
       WHERE f.user_id = $1
       ORDER BY u.name ASC`,
      [req.user!.id]
    );
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/favorites', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { favorite_id, nickname } = req.body;
    if (!favorite_id) { res.status(400).json({ error: 'favorite_id required' }); return; }

    await pool.query(
      'INSERT INTO favorites (user_id, favorite_id, nickname) VALUES ($1, $2, $3) ON CONFLICT (user_id, favorite_id) DO UPDATE SET nickname = $3',
      [req.user!.id, favorite_id, nickname]
    );
    res.json({ success: true, message: 'Contact saved to favorites' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/fx-rates', async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({
    rates: {
      USD: { TZS: 2540, KES: 130.5, UGX: 3720, GBP: 0.789, EUR: 0.921 },
      TZS: { USD: 0.000394, KES: 0.0514, UGX: 1.464, GBP: 0.000311 },
      KES: { TZS: 19.46, USD: 0.00766, UGX: 28.49, GBP: 0.00604 },
      GBP: { TZS: 3218, USD: 1.267, KES: 165.6, UGX: 4713 },
      EUR: { TZS: 2766, USD: 1.086, KES: 141.7, GBP: 0.856 },
    },
    updated_at: new Date().toISOString(),
    source: 'SafariPay FX Engine'
  });
});

/**
 * @notice Resolves a phone number to a Smart Wallet address via Blockchain SNS
 */
router.get('/sns/resolve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { phone } = req.query;
    if (!phone) { res.status(400).json({ error: 'phone missing' }); return; }

    const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(phone as string));
    const registry = BlockchainService.getContract('SAFARIPAY_PHONE_REGISTRY');

    // Query the blockchain SNS registry
    const walletAddress = await registry.resolve(phoneHash);

    if (!walletAddress || walletAddress === ethers.ZeroAddress) {
      res.status(404).json({ error: 'Phone number not linked to a SafariPay wallet on-chain' });
      return;
    }

    // Lookup friendly name in DB (UX only, indexing)
    const { rows } = await pool.query('SELECT name, country, currency FROM users WHERE wallet_address=$1', [walletAddress]);

    res.json({
      wallet_address: walletAddress,
      name: rows[0]?.name || 'On-Chain User',
      country: rows[0]?.country,
      currency: rows[0]?.currency,
      isBlockchainResolved: true
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
