/**
 * SafariPay — Blockchain Configuration
 * ======================================
 * Centralized configuration for Polygon network, RPC providers,
 * contract addresses, and gas parameters.
 *
 * Supports: Alchemy, Infura, or any custom JSON-RPC endpoint.
 * Environment: Reads from process.env with safe fallbacks for development.
 *
 * NETWORK ROUTING:
 *   development → Polygon Amoy Testnet (chainId: 80002)
 *   production  → Polygon Mainnet      (chainId: 137)
 */

// ─── Network Constants ───────────────────────────────────────────────
export const POLYGON_MAINNET = {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcDefault: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    currency: 'MATIC',
} as const;

export const POLYGON_AMOY = {
    chainId: 80002,
    name: 'Polygon Amoy Testnet',
    rpcDefault: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    currency: 'MATIC',
} as const;

// ─── Environment Detection ──────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// ─── RPC Configuration ─────────────────────────────────────────────
// Priority: RPC_URL env var > provider-specific URL > network default
function resolveRpcUrl(): string {
    // 1. Explicit RPC_URL always wins (use this in .env)
    if (process.env.RPC_URL) return process.env.RPC_URL;

    // 2. Provider-specific URLs (auto-route based on NODE_ENV)
    if (process.env.ALCHEMY_API_KEY) {
        const network = isProduction ? 'polygon-mainnet' : 'polygon-amoy';
        return `https://${network}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
    }
    if (process.env.INFURA_API_KEY) {
        const network = isProduction ? 'polygon-mainnet' : 'polygon-amoy';
        return `https://${network}.infura.io/v3/${process.env.INFURA_API_KEY}`;
    }

    // 3. Default public RPC (rate-limited, only for development)
    if (isProduction) {
        console.error('⛔ [BLOCKCHAIN] FATAL: No RPC_URL configured for production!');
        console.error('   Set RPC_URL, ALCHEMY_API_KEY, or INFURA_API_KEY in your .env');
        process.exit(1);
    }

    return POLYGON_AMOY.rpcDefault;
}

// ─── Contract Addresses ─────────────────────────────────────────────
/**
 * USDT Addresses:
 *   Mainnet: 0xc2132D05D31c914a87C6611C10748AEb04B58e8F (real PoS USDT, 6 decimals)
 *   Testnet: Deploy your own mock ERC-20 on Amoy via Remix/Hardhat and set
 *            USDT_CONTRACT_ADDRESS_TESTNET in .env
 *
 * If no testnet address is provided, a known Amoy test token is used as a
 * placeholder — it WILL NOT hold real value.
 */
const AMOY_USDT_PLACEHOLDER = '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582'; // Common Amoy mock USDT

function resolveUsdtAddress(): string {
    if (isProduction) {
        return process.env.USDT_CONTRACT_ADDRESS_MAINNET
            || process.env.USDT_CONTRACT_ADDRESS
            || '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';
    }
    // Testnet: prioritize explicit testnet address, fall back to placeholder
    return process.env.USDT_CONTRACT_ADDRESS_TESTNET
        || process.env.USDT_CONTRACT_ADDRESS
        || AMOY_USDT_PLACEHOLDER;
}

const CONTRACTS = {
    /** USDT — environment-aware (Mainnet real / Amoy mock) */
    USDT: resolveUsdtAddress(),

    /** SafariPay Wallet Contract (deploy and set in .env) */
    SAFARIPAY_WALLET: process.env.SAFARIPAY_WALLET_CONTRACT || '',

    /** SafariPay Pool — Master wallet that holds platform liquidity */
    SAFARIPAY_POOL: process.env.SAFARIPAY_POOL_ADDRESS || '',

    /** Credit Scoring Contract */
    CREDIT_SCORING: process.env.CREDIT_SCORING_CONTRACT || '',

    /** Lending Pool Contract */
    LENDING_POOL: process.env.LENDING_POOL_CONTRACT || '',

    /** Smart Wallet Factory (ERC-4337 Registry) */
    SAFARI_WALLET_FACTORY: process.env.SAFARI_WALLET_FACTORY_ADDRESS || '0x43376af840939393939393939393939393939393',

    /** Smart Wallet Template (Address is dynamic per user) */
    SAFARI_SMART_WALLET: '',

    /** Phone-to-Wallet Identity Registry (SNS) */
    SAFARIPAY_PHONE_REGISTRY: process.env.SAFARIPAY_PHONE_REGISTRY_ADDRESS || '0x574f26034e42a3a5f8b9cad0e1f2031a2f082d72',

    /** Uniswap V3 Router on Polygon (for Auto-Conversion) */
    UNISWAP_V3_ROUTER: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    /** Uniswap V3 Quoter on Polygon */
    UNISWAP_V3_QUOTER: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
} as const;

// ─── ABIs ───────────────────────────────────────────────────────────
// Standard ERC-20 ABI (covers USDT and all ERC-20 tokens)
const ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address owner) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function transferFrom(address from, address to, uint256 amount) returns (bool)',
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'event Approval(address indexed owner, address indexed spender, uint256 value)',
] as const;

const SAFARIPAY_WALLET_ABI = [
    'function deposit(uint256 amount) external',
    'function transfer(address to, uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function balances(address user) view returns (uint256)',
    'event Deposit(address indexed user, uint256 amount)',
    'event Transfer(address indexed from, address indexed to, uint256 amount)',
    'event Withdrawal(address indexed user, uint256 amount)',
] as const;

const CREDIT_SCORING_ABI = [
    'function updateScore(address user, uint256 transactionCount, uint256 volume) external',
    'function getScore(address user) view returns (uint256)',
] as const;

const LENDING_POOL_ABI = [
    'function requestLoan(uint256 amount) external',
    'function repayLoan() external',
    'function activeLoans(address user) view returns (uint256 amount, uint256 repaymentAmount, uint256 dueDate, bool active)',
] as const;

const SAFARI_WALLET_FACTORY_ABI = [
    'function createWallet(address owner, bytes32 nidaHash, bytes32 phoneHash, bytes32 salt) external returns (address)',
    'function predictAddress(address owner, bytes32 nidaHash, bytes32 phoneHash, bytes32 salt) public view returns (address)',
    'event WalletDeployed(address indexed walletAddress, address indexed owner, bytes32 nidaHash)',
] as const;

const SAFARI_SMART_WALLET_ABI = [
    'function owner() view returns (address)',
    'function nonce() view returns (uint256)',
    'function execute(address dest, uint256 value, bytes calldata func) external',
    'function executeByGuardian(address dest, uint256 value, bytes calldata func) external',
    'function requestRecovery(address newOwner, bytes calldata guardianSignature, string calldata providedNida, string calldata providedPhone) external',
    'event WalletRecovered(address indexed oldOwner, address indexed newOwner)',
    'event TransactionExecuted(address indexed to, uint256 value, bytes data)'
] as const;

const UNISWAP_ROUTER_ABI = [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
    'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
] as const;

const SAFARIPAY_PHONE_REGISTRY_ABI = [
    'function registerIdentity(bytes32 phoneHash, address wallet) external',
    'function resolve(bytes32 phoneHash) view returns (address)',
    'event IdentityLinked(bytes32 indexed phoneHash, address indexed wallet)',
] as const;

// ─── Gas Configuration ──────────────────────────────────────────────
const GAS_CONFIG = {
    /** Max priority fee (tip to validators), in Gwei */
    maxPriorityFeeGwei: isProduction ? '35' : '30',
    /** Gas limit multiplier (1.2 = 20% buffer above estimate) */
    gasLimitMultiplier: 1.2,
    /** Max gas price in Gwei (safety cap to prevent overpaying) */
    maxGasPriceGwei: isProduction ? '500' : '100',
    /** Number of block confirmations to wait */
    confirmations: isProduction ? 3 : 1,
} as const;

// ─── Exported Configuration ─────────────────────────────────────────
export const BlockchainConfig = {
    network: isProduction ? POLYGON_MAINNET : POLYGON_AMOY,
    rpcUrl: resolveRpcUrl(),
    chainId: isProduction ? POLYGON_MAINNET.chainId : POLYGON_AMOY.chainId,
    isProduction,
    contracts: CONTRACTS,
    abis: {
        ERC20: ERC20_ABI,
        SAFARIPAY_WALLET: SAFARIPAY_WALLET_ABI,
        CREDIT_SCORING: CREDIT_SCORING_ABI,
        LENDING_POOL: LENDING_POOL_ABI,
        SAFARI_WALLET_FACTORY: SAFARI_WALLET_FACTORY_ABI,
        SAFARI_SMART_WALLET: SAFARI_SMART_WALLET_ABI,
        SAFARIPAY_PHONE_REGISTRY: SAFARIPAY_PHONE_REGISTRY_ABI,
        UNISWAP_ROUTER: UNISWAP_ROUTER_ABI,
    },
    gas: GAS_CONFIG,
    /** USDT uses 6 decimals on Polygon */
    USDT_DECIMALS: 6,
} as const;
