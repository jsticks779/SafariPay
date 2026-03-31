/**
 * SafariPay — Regional Validation & Formatting Logic
 * =================================================
 * Encapsulates the complex rules for phone numbers and financial
 * accounts across Tanzania, Kenya, and Uganda.
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
  provider?: string;
  formatted?: string;
}

export const COUNTRY_FORMATS: Record<string, { prefix: string, length: number, regex: RegExp }> = {
  'TZ': { prefix: '+255', length: 10, regex: /^(0|255|(\+255))[67][0-9]{8}$/ },
  'KE': { prefix: '+254', length: 10, regex: /^(0|254|(\+254))[71][0-9]{8}$/ },
  'UG': { prefix: '+256', length: 10, regex: /^(0|256|(\+256))[7][0-9]{8}$/ }
};

export const PROVIDER_RULES: Record<string, string[]> = {
  'TZ_VODACOM': ['074', '075', '076'],
  'TZ_TIGO': ['065', '067', '071'],
  'TZ_AIRTEL': ['068', '069', '078'],
  'TZ_HALOTEL': ['061', '062'],
  'KE_SAFARICOM': ['070', '071', '072', '074', '079', '011'],
  'KE_AIRTEL': ['073', '075', '078'],
  'KE_TELKOM': ['077'],
  'UG_MTN': ['077', '078', '076'],
  'UG_AIRTEL': ['075', '070']
};

/**
 * Validates and formats a phone number for the given country.
 */
export const validatePhone = (phone: string, country: string = 'TZ'): ValidationResult => {
  const cfg = COUNTRY_FORMATS[country] || COUNTRY_FORMATS['TZ'];
  let clean = phone.replace(/[\s\-\(\)]/g, '');
  
  if (!cfg.regex.test(clean)) {
    return { isValid: false, message: `Invalid ${country} phone format` };
  }

  // Detect Provider
  let local = clean;
  if (local.startsWith(cfg.prefix)) local = '0' + local.slice(cfg.prefix.length);
  else if (local.startsWith(cfg.prefix.slice(1))) local = '0' + local.slice(cfg.prefix.length - 1);
  
  const prefix3 = local.slice(0, 3);
  let provider = 'Unknown';
  for (const [key, prefixes] of Object.entries(PROVIDER_RULES)) {
    if (key.startsWith(country) && prefixes.includes(prefix3)) {
      provider = key.split('_')[1];
      break;
    }
  }

  // Standardize to E.164-like but local friendly
  const formatted = cfg.prefix + local.slice(1);

  return { isValid: true, provider, formatted };
};

export const detectPhoneCountry = (phone: string): string | null => {
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  if (clean.startsWith('+255') || clean.startsWith('255') || clean.startsWith('06') || clean.startsWith('07')) {
    // Basic heuristics: if it starts with 07 and is 10 digits, we can't be sure, but prefixes give a hint.
    // For exact match:
    for (const [code, cfg] of Object.entries(COUNTRY_FORMATS)) {
        if (cfg.regex.test(clean)) return code;
    }
  }
  for (const [code, cfg] of Object.entries(COUNTRY_FORMATS)) {
      if (clean.startsWith(cfg.prefix) || clean.startsWith(cfg.prefix.replace('+', ''))) return code;
  }
  return null;
};

/**
 * Validates bank account numbers (usually 10-14 digits)
 */
export const validateAccount = (account: string, provider: string): ValidationResult => {
  const clean = account.replace(/\D/g, '');
  if (clean.length < 10 || clean.length > 16) {
    return { isValid: false, message: 'Account must be 10-16 digits' };
  }
  return { isValid: true };
};
