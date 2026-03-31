import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { testConnection } from './db/database';
import { BlockchainService } from './services/blockchain.service';
import { BlockchainConfig } from './config/blockchain.config';

import txRoutes from './routes/transactions';
import loanRoutes from './routes/loans';
import userRoutes from './routes/users';
import systemRoutes from './routes/system';

import authRoutesV1 from './routes/v1/auth.routes';
import transferRoutesV1 from './routes/v1/transfer.routes';
import { ErrorMiddleware } from './middleware/error.middleware';
import { Responder } from './utils/responder';

import kycRoutes from './routes/v1/kyc.routes';
import walletRoutes from './routes/wallet.routes';
import bridgeRoutes from './routes/bridge.routes';
import debugRoutes from './routes/debug.routes';

const app = express();
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:3002'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use(morgan('dev'));

app.use('/api/', rateLimit({ windowMs: 60_000, max: 1000, message: { error: 'Too many requests' } }));

app.get('/health', (_, res) => Responder.ok(res, { status: 'ok', service: 'SafariPay API v1.1', time: new Date() }));

import adminRoutes from './routes/admin';

/** v1 API Routing (Global & Versatile Architecture) */
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/auth', authRoutesV1);
app.use('/api/v1/kyc', kycRoutes);
app.use('/api/v1/transactions', txRoutes);
app.use('/api/v1/transfer', transferRoutesV1);
app.use('/api/v1/loans', loanRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/bridge', bridgeRoutes);
app.use('/api/v1/debug', debugRoutes);
app.use('/api/v1/system', systemRoutes);

/** Legacy API Fallbacks (Systems Harmony) */
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutesV1);
app.use('/api/system', systemRoutes);
app.use('/api/users', userRoutes);

app.use('*', (_, res) => Responder.error(res, 'Route not found: ' + (_.originalUrl), 404));

/** Centralized Error Handling Middleware (Project Foundation) */
app.use(ErrorMiddleware.handle);

const PORT = Number(process.env.PORT) || 4000;

(async () => {
  try {
    await testConnection();

    // 📱 [JUDGE DEMO] Permanent Simulation Store
    const pool = require('./db/database').default;
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_phone TEXT NOT NULL,
        sender TEXT DEFAULT 'SAFARIPAY',
        message TEXT NOT NULL,
        msg_type TEXT NOT NULL,
        channel TEXT NOT NULL,
        amount NUMERIC,
        provider TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure column exists for older runs
    await pool.query(`ALTER TABLE system_messages ADD COLUMN IF NOT EXISTS sender TEXT DEFAULT 'SAFARIPAY'`);
    console.log('✅ Permanent Messaging Store initialized');

    // 🔗 Verify Polygon connectivity at startup
    console.log(`\n⛓️  Connecting to ${BlockchainConfig.network.name} (chainId: ${BlockchainConfig.chainId})...`);
    const blockchainOk = await BlockchainService.verifyConnection();
    if (!blockchainOk) {
      console.warn('⚠️  Blockchain connection issue — API will run but on-chain features may fail');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🦁 SafariPay API → http://localhost:${PORT}`);
      console.log(`📊 Health       → http://localhost:${PORT}/health`);
      console.log(`⛓️  Network     → ${BlockchainConfig.network.name} (${BlockchainConfig.isProduction ? 'MAINNET' : 'TESTNET'})`);
      console.log(`🔗 Explorer     → ${BlockchainConfig.network.explorer}\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
