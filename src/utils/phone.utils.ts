/**
 * Mapping of country calling codes to ISO 3166-1 alpha-2 country codes
 * Covers ~200 countries with calling codes ranging from 1-3 digits
 */
const CALLING_CODE_TO_COUNTRY: Record<string, string> = {
  // 3-digit codes
  '355': 'AL', '213': 'DZ', '376': 'AD', '244': 'AO', '672': 'AQ',
  '374': 'AM', '297': 'AW', '994': 'AZ', '973': 'BH', '880': 'BD',
  '375': 'BY', '501': 'BZ', '229': 'BJ', '975': 'BT', '591': 'BO',
  '387': 'BA', '267': 'BW', '673': 'BN', '359': 'BG', '226': 'BF',
  '257': 'BI', '855': 'KH', '237': 'CM', '238': 'CV', '236': 'CF',
  '235': 'TD', '269': 'KM', '242': 'CG', '243': 'CD', '506': 'CR',
  '385': 'HR', '357': 'CY', '420': 'CZ', '253': 'DJ', '593': 'EC',
  '503': 'SV', '240': 'GQ', '291': 'ER', '372': 'EE', '251': 'ET',
  '679': 'FJ', '358': 'FI', '241': 'GA', '220': 'GM', '995': 'GE',
  '233': 'GH', '350': 'GI', '299': 'GL', '502': 'GT', '224': 'GN',
  '245': 'GW', '592': 'GY', '509': 'HT', '504': 'HN', '354': 'IS',
  '964': 'IQ', '353': 'IE', '972': 'IL', '225': 'CI', '962': 'JO',
  '254': 'KE', '686': 'KI', '965': 'KW', '996': 'KG', '856': 'LA',
  '371': 'LV', '961': 'LB', '266': 'LS', '231': 'LR', '218': 'LY',
  '423': 'LI', '370': 'LT', '352': 'LU', '389': 'MK', '261': 'MG',
  '265': 'MW', '960': 'MV', '223': 'ML', '356': 'MT', '692': 'MH',
  '222': 'MR', '230': 'MU', '262': 'YT', '691': 'FM', '373': 'MD',
  '377': 'MC', '976': 'MN', '382': 'ME', '258': 'MZ', '264': 'NA',
  '674': 'NR', '977': 'NP', '505': 'NI', '227': 'NE', '234': 'NG',
  '683': 'NU', '968': 'OM', '680': 'PW', '970': 'PS', '507': 'PA',
  '675': 'PG', '595': 'PY', '351': 'PT', '974': 'QA', '250': 'RW',
  '685': 'WS', '378': 'SM', '239': 'ST', '966': 'SA', '221': 'SN',
  '381': 'RS', '248': 'SC', '232': 'SL', '421': 'SK', '386': 'SI',
  '677': 'SB', '252': 'SO', '211': 'SS', '249': 'SD', '597': 'SR',
  '268': 'SZ', '963': 'SY', '992': 'TJ', '255': 'TZ', '228': 'TG',
  '676': 'TO', '216': 'TN', '993': 'TM', '688': 'TV', '256': 'UG',
  '380': 'UA', '971': 'AE', '598': 'UY', '998': 'UZ', '678': 'VU',
  '379': 'VA', '967': 'YE', '260': 'ZM', '263': 'ZW',

  // 2-digit codes
  '93': 'AF', '54': 'AR', '61': 'AU', '43': 'AT', '32': 'BE',
  '55': 'BR', '56': 'CL', '86': 'CN', '57': 'CO', '53': 'CU',
  '45': 'DK', '20': 'EG', '33': 'FR', '49': 'DE', '30': 'GR',
  '36': 'HU', '91': 'IN', '62': 'ID', '98': 'IR', '39': 'IT',
  '81': 'JP', '82': 'KR', '60': 'MY', '52': 'MX', '31': 'NL',
  '64': 'NZ', '47': 'NO', '92': 'PK', '51': 'PE', '63': 'PH',
  '48': 'PL', '40': 'RO', '65': 'SG', '27': 'ZA', '34': 'ES',
  '94': 'LK', '46': 'SE', '41': 'CH', '66': 'TH', '90': 'TR',
  '44': 'GB', '58': 'VE', '84': 'VN',

  // 1-digit codes (shared codes default to most common country)
  '1': 'US', // Also CA, but default to US
  '7': 'RU', // Also KZ, but default to RU
};

/**
 * Extract ISO country code from E.164 phone number
 * @param phone Phone number in E.164 format (e.g., +919876543210)
 * @returns ISO 3166-1 alpha-2 country code (e.g., "IN") or undefined
 */
export function extractCountryFromPhone(phone: string): string | undefined {
  // Remove + prefix if present
  const digits = phone.startsWith('+') ? phone.slice(1) : phone;

  // Try matching from longest to shortest prefix (3, 2, 1 digits)
  for (const length of [3, 2, 1]) {
    const prefix = digits.slice(0, length);
    if (CALLING_CODE_TO_COUNTRY[prefix]) {
      return CALLING_CODE_TO_COUNTRY[prefix];
    }
  }

  return undefined;
}

/**
 * Normalize phone number to E.164 format with + prefix
 * @param phone Phone number (with or without + prefix)
 * @returns Phone number in E.164 format
 */
export function normalizePhoneNumber(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}
