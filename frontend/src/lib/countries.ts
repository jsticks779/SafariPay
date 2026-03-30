export interface Country {
    code: string;
    name: string;
    flag: string;
    prefix: string;
    idName: string;
    pattern: RegExp;
    placeholder: string;
    currency: string;
    providers?: { id: string, label: string }[];
    banks?: { id: string, label: string }[];
}

/**
 * Expanded International Country Matrix
 * -------------------------------------
 * Standardizes ID formats, currencies, and local providers globally.
 */
export const ALL_COUNTRIES: Country[] = [
    {
        code: 'KE', name: 'Kenya', flag: '🇰🇪', prefix: '+254', idName: 'National ID', pattern: /^\d{7,10}$/, placeholder: '7-10 Digit ID', currency: 'KES',
        providers: [
            { id: 'mpesa', label: 'Safaricom M-Pesa' },
            { id: 'airtel', label: 'Airtel Money' }
        ],
        banks: [{ id: 'kcb', label: 'KCB Bank' }, { id: 'equity', label: 'Equity Bank' }]
    },
    {
        code: 'TZ', name: 'Tanzania', flag: '🇹🇿', prefix: '+255', idName: 'NIDA', pattern: /^\d{20}$/, placeholder: '20-Digit NIDA', currency: 'TZS',
        providers: [
            { id: 'mpesa', label: 'Vodacom M-Pesa' },
            { id: 'tigo', label: 'Tigo Pesa' },
            { id: 'airtel', label: 'Airtel Money' },
            { id: 'halopesa', label: 'Halopesa' }
        ],
        banks: [{ id: 'crdb', label: 'CRDB Bank' }, { id: 'nmb', label: 'NMB Bank' }]
    },
    {
        code: 'UG', name: 'Uganda', flag: '🇺🇬', prefix: '+256', idName: 'National ID', pattern: /^[A-Z0-9]{14}$/, placeholder: '14-Character ID', currency: 'UGX',
        providers: [{ id: 'mtn', label: 'MTN MoMo' }, { id: 'airtel', label: 'Airtel Money' }],
        banks: [{ id: 'stanbic', label: 'Stanbic Bank' }, { id: 'centenary', label: 'Centenary Bank' }]
    },
    {
        code: 'NG', name: 'Nigeria', flag: '🇳🇬', prefix: '+234', idName: 'NIN', pattern: /^\d{11}$/, placeholder: '11-Digit NIN', currency: 'NGN',
        providers: [{ id: 'opay', label: 'OPay' }, { id: 'palmpay', label: 'PalmPay' }],
        banks: [{ id: 'gtbank', label: 'GTBank' }, { id: 'zenith', label: 'Zenith Bank' }]
    },
    {
        code: 'GH', name: 'Ghana', flag: '🇬🇭', prefix: '+233', idName: 'Ghana Card', pattern: /^GHA-\d{9}-\d{1}$/, placeholder: 'GHA-XXXXXXXXX-X', currency: 'GHS',
        providers: [{ id: 'mtn', label: 'MTN Mobile Money' }, { id: 'telecel', label: 'Telecel Cash' }],
        banks: [{ id: 'eco', label: 'Ecobank Ghana' }]
    },
    {
        code: 'RW', name: 'Rwanda', flag: '🇷🇼', prefix: '+250', idName: 'National ID', pattern: /^\d{16}$/, placeholder: '16-Digit ID', currency: 'RWF',
        providers: [{ id: 'mtn', label: 'MTN MoMo' }],
    },
    {
        code: 'ZA', name: 'South Africa', flag: '🇿🇦', prefix: '+27', idName: 'RSA ID', pattern: /^\d{13}$/, placeholder: '13-Digit ID', currency: 'ZAR',
        providers: [{ id: 'standard', label: 'Standard Bank' }, { id: 'capitec', label: 'Capitec' }],
    },
    {
        code: 'US', name: 'United States', flag: '🇺🇸', prefix: '+1', idName: 'Passport/DL', pattern: /^[A-Z0-9]{6,12}$/i, placeholder: 'ID/SSN', currency: 'USD',
        banks: [{ id: 'chase', label: 'JP Morgan Chase' }, { id: 'boa', label: 'Bank of America' }]
    },
    {
        code: 'GB', name: 'United Kingdom', flag: '🇬🇧', prefix: '+44', idName: 'ID/Passport', pattern: /^[A-Z0-9]{9}$/i, placeholder: 'Passport #', currency: 'GBP',
        banks: [{ id: 'hsbc', label: 'HSBC UK' }, { id: 'barclays', label: 'Barclays' }]
    },
    {
        code: 'AE', name: 'U.A.E', flag: '🇦🇪', prefix: '+971', idName: 'Emirates ID', pattern: /^\d{15}$/, placeholder: '15-Digit ID', currency: 'AED',
        banks: [{ id: 'enbd', label: 'Emirates NBD' }]
    },
    {
        code: 'IND', name: 'India', flag: '🇮🇳', prefix: '+91', idName: 'Aadhaar', pattern: /^\d{12}$/, placeholder: '12-Digit Aadhaar', currency: 'INR',
        providers: [{ id: 'paytm', label: 'Paytm' }, { id: 'phonepe', label: 'PhonePe' }],
    },
    {
        code: 'CN', name: 'China', flag: '🇨🇳', prefix: '+86', idName: 'Resident ID', pattern: /^\d{18}$/, placeholder: '18-Digit ID', currency: 'CNY',
        providers: [{ id: 'alipay', label: 'Alipay' }, { id: 'wechat', label: 'WeChat Pay' }],
    },
    {
        code: 'MX', name: 'Mexico', flag: '🇲🇽', prefix: '+52', idName: 'INE/CURP', pattern: /^[A-Z0-9]{18}$/i, placeholder: '18-Character CURP', currency: 'MXN',
        providers: [{ id: 'bbva', label: 'BBVA México' }, { id: 'oxxo', label: 'OXXO Pay' }],
        banks: [{ id: 'banamex', label: 'Citibanamex' }]
    },
    {
        code: 'ID', name: 'Indonesia (Bali)', flag: '🇮🇩', prefix: '+62', idName: 'KTP/NIK', pattern: /^\d{16}$/, placeholder: '16-Digit NIK', currency: 'IDR',
        providers: [{ id: 'gojek', label: 'GoPay' }, { id: 'ovo', label: 'OVO' }],
        banks: [{ id: 'bca', label: 'Bank Central Asia' }]
    }
];

/**
 * Universal Global Fallback
 * Extracts a country profile for any other nation.
 */
export const getCountryByCode = (code: string): Country => {
    const country = ALL_COUNTRIES.find(c => c.code === code);
    if (country) return country;

    // Generic fallback for any other country
    return {
        code: code,
        name: 'International',
        flag: '🌍',
        prefix: '+',
        idName: 'National ID',
        pattern: /^[A-Z0-9]{4,20}$/i,
        placeholder: 'ID or Passport #',
        currency: 'USD'
    };
};
