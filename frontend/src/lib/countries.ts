export const ALL_COUNTRIES = [
    {
        code: 'KE', name: 'Kenya', flag: '🇰🇪', prefix: '+254', idName: 'National ID', pattern: /^\d{7,10}$/, placeholder: 'ID Number', currency: 'KES',
        providers: [
            { id: 'mpesa', label: 'Safaricom M-Pesa' },
            { id: 'airtel', label: 'Airtel Money' },
            { id: 'telkom', label: 'Telkom T-Kash' }
        ],
        banks: [
            { id: 'kcb', label: 'KCB Bank' },
            { id: 'equity', label: 'Equity Bank' },
            { id: 'coop', label: 'Co-operative Bank' },
            { id: 'absake', label: 'ABSA Kenya' }
        ]
    },
    {
        code: 'TZ', name: 'Tanzania', flag: '🇹🇿', prefix: '+255', idName: 'NIDA', pattern: /^\d{20}$/, placeholder: '199XXXXXXXXXXXXXXX', currency: 'TZS',
        providers: [
            { id: 'mpesa', label: 'Vodacom M-Pesa' },
            { id: 'airtel', label: 'Airtel Money' },
            { id: 'tigo', label: 'Tigo Pesa' },
            { id: 'halopesa', label: 'Halopesa' }
        ],
        banks: [
            { id: 'crdb', label: 'CRDB Bank' },
            { id: 'nmb', label: 'NMB Bank' },
            { id: 'nbc', label: 'NBC Bank' },
            { id: 'stanbic', label: 'Stanbic Bank' }
        ]
    },
    {
        code: 'UG', name: 'Uganda', flag: '🇺🇬', prefix: '+256', idName: 'National ID', pattern: /^[A-Z0-9]{14}$/, placeholder: 'ID Number', currency: 'UGX',
        providers: [
            { id: 'mtn', label: 'MTN MoMo' },
            { id: 'airtel', label: 'Airtel Money' }
        ],
        banks: [
            { id: 'stanbic', label: 'Stanbic Bank' },
            { id: 'dfcu', label: 'DFCU Bank' },
            { id: 'centenary', label: 'Centenary Bank' }
        ]
    }
];
