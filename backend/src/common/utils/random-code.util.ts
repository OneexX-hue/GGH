import { randomBytes } from 'crypto';

const DEFAULT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов (0/O, 1/I)

/**
 * Человекочитаемый случайный код (инвайты, коды чекпоинтов квестов и т.п.) —
 * группы символов через дефис, например "ABCDE-FGHJK".
 */
export function generateRandomCode(groupCount = 2, groupLength = 5, alphabet = DEFAULT_ALPHABET): string {
  const bytes = randomBytes(groupCount * groupLength);
  let code = '';
  for (const byte of bytes) {
    code += alphabet[byte % alphabet.length];
  }
  return Array.from({ length: groupCount }, (_, i) => code.slice(i * groupLength, (i + 1) * groupLength)).join('-');
}
