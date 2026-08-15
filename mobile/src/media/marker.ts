import type { MediaKind } from './types';

const MARKER_PREFIX = '##CARCLUB_MEDIA##';

export interface MediaMarker {
  mediaId: string;
  kind: MediaKind;
}

export function encodeMediaMarker(marker: MediaMarker): string {
  return `${MARKER_PREFIX}${JSON.stringify(marker)}`;
}

export function decodeMediaMarker(text: string): MediaMarker | null {
  if (!text.startsWith(MARKER_PREFIX)) return null;
  try {
    const parsed = JSON.parse(text.slice(MARKER_PREFIX.length));
    if (typeof parsed.mediaId === 'string' && (parsed.kind === 'PHOTO' || parsed.kind === 'VIDEO')) {
      return { mediaId: parsed.mediaId, kind: parsed.kind };
    }
    return null;
  } catch {
    return null;
  }
}
