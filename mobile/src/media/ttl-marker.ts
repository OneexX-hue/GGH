const MARKER_PREFIX = '##CARCLUB_TTL##';

export interface TtlMarker {
  expiresAt: string; // ISO
  body: string; // исходный текст или медиа-маркер
}

export function encodeTtlMarker(marker: TtlMarker): string {
  return `${MARKER_PREFIX}${JSON.stringify(marker)}`;
}

export function decodeTtlMarker(text: string): TtlMarker | null {
  if (!text.startsWith(MARKER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(MARKER_PREFIX.length));
    if (typeof parsed.expiresAt === 'string' && typeof parsed.body === 'string') {
      return { expiresAt: parsed.expiresAt, body: parsed.body };
    }
    return null;
  } catch {
    return null;
  }
}
