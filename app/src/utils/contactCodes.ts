/**
 * Codes for a contact's country and preferred contact language.
 *
 * Mirrors `App\Support\ContactCodes` in the API, which validates against the
 * same lists — the two images cannot share a file, so keep them in step by
 * hand. Only codes are stored; names come from `Intl.DisplayNames` in the
 * admin's own language, so no catalogue holds 250 country names.
 */

export const COUNTRY_CODES = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'XK', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const

export const CONTACT_LANGUAGE_CODES = [
  'af', 'ar', 'az', 'be', 'bg', 'bn', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'es', 'et',
  'eu', 'fa', 'fi', 'fr', 'ga', 'gl', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'ja', 'ka',
  'kk', 'ko', 'lb', 'lt', 'lv', 'mk', 'mn', 'ms', 'mt', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk',
  'sl', 'sq', 'sr', 'sv', 'sw', 'ta', 'th', 'tl', 'tr', 'uk', 'ur', 'uz', 'vi', 'yi', 'zh',
] as const

export interface CodeOption {
  code: string
  label: string
}

// Names depend only on the UI language, and every AuthorForm mount (the
// authors modal, each AuthorQuickAdd) would otherwise re-sort 250 of them.
const cache = new Map<string, CodeOption[]>()

function namedOptions(codes: readonly string[], uiLang: string, type: 'region' | 'language'): CodeOption[] {
  const key = `${type}:${uiLang}`
  const hit = cache.get(key)
  if (hit) return hit
  const names = new Intl.DisplayNames([uiLang], { type, fallback: 'code' })
  const collator = new Intl.Collator(uiLang)
  const options = codes
    .map((code) => ({ code, label: names.of(code) ?? code }))
    .sort((a, b) => collator.compare(a.label, b.label))
  cache.set(key, options)
  return options
}

/** Every country, named and alphabetised in the admin's language. */
export function countryOptions(uiLang: string): CodeOption[] {
  return namedOptions(COUNTRY_CODES, uiLang, 'region')
}

/** Contact languages, named and alphabetised in the admin's language. */
export function contactLanguageOptions(uiLang: string): CodeOption[] {
  return namedOptions(CONTACT_LANGUAGE_CODES, uiLang, 'language')
}
