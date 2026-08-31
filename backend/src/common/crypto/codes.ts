import { randomBytes, randomInt, createHash } from 'node:crypto';

// Алфавит Крокфорда: из него выброшены I, L, O и U — при переписывании кода
// с бумаги их путают с 1, 0 и V. Остальные 32 символа однозначны.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function pick(alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[randomInt(alphabet.length)];
  }
  return out;
}

/**
 * Приводит к каноничному виду всё, что мог ввести человек с бумаги:
 * убирает дефисы и пробелы, чинит классические подмены символов.
 */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

/** Код из QR: 8 символов, на бумаге печатается как XXXX-XXXX. */
export function generateInviteCode(): string {
  return pick(CROCKFORD, 8);
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Резервный код входа без телефона: 10 символов, показывается как XXXXX-XXXXX. */
export function generateBackupCode(): string {
  return pick(CROCKFORD, 10);
}

export function formatBackupCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function generatePassword(length = 12): string {
  return pick(PASSWORD_ALPHABET, length);
}

/** Резервные коды одноразовые и высокоэнтропийные — соль не нужна. */
export function hashLookupCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
