/**
 * Нормализация кодов заданий.
 *
 * Игрок вводит код на бегу, с телефонной клавиатуры, часто с автозаглавной буквой
 * и случайным пробелом. Сравнивать сырые строки — значит отказывать в правильных
 * ответах. Нормализуем одинаково при сохранении задания и при проверке ответа.
 */
export function normalizeCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[ЁE]/g, 'Е'); // латинская E и Ё сводятся к кириллической Е
}

export function codesMatch(a: string, b: string): boolean {
  return normalizeCode(a) === normalizeCode(b);
}

/** Ссылка для QR-кода задания. Сканирование избавляет от ручного ввода. */
export function taskQrPayload(eventSlug: string, code: string): string {
  return `quest://${eventSlug}/code/${encodeURIComponent(normalizeCode(code))}`;
}

/** Разбор отсканированного QR. Возвращает null, если это чужой код. */
export function parseQrPayload(raw: string): { eventSlug: string; code: string } | null {
  const match = /^quest:\/\/([a-z0-9-]{3,48})\/code\/(.+)$/.exec(raw.trim());
  if (!match?.[1] || !match[2]) return null;
  return { eventSlug: match[1], code: normalizeCode(decodeURIComponent(match[2])) };
}
