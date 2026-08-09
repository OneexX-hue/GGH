import { API_BASE_URL, apiFetch } from '../api';
import type { MediaAccessTokenResult, MediaKind, UploadMediaResult } from './types';

export class MediaApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Загружает файл в наше собственное хранилище (backend/src/media) — НЕ в
 * Rocket.Chat. Байты чата никогда не проходят через RC, см.
 * docs/DECISIONS.md, "Хранилище медиа в чате".
 */
export async function uploadMedia(
  fileUri: string,
  mimeType: string,
  fileName: string,
  authToken: string,
): Promise<UploadMediaResult> {
  const form = new FormData();
  // React Native fetch принимает такой объект вместо настоящего File/Blob.
  form.append('file', { uri: fileUri, type: mimeType, name: fileName } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new MediaApiError(response.status, body.message ?? 'Не удалось загрузить файл');
  }

  return response.json() as Promise<UploadMediaResult>;
}

export async function getMediaAccessToken(mediaId: string, authToken: string): Promise<MediaAccessTokenResult> {
  return apiFetch<MediaAccessTokenResult>(`/media/${mediaId}/token`, { token: authToken });
}

export async function reportMediaAccessEvent(
  mediaId: string,
  action: 'DOWNLOAD_ATTEMPT' | 'SCREENSHOT_DETECTED',
  authToken: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await apiFetch(`/media/${mediaId}/access-log`, {
    method: 'POST',
    token: authToken,
    body: { action, metadata },
  });
}

export function mediaContentUrl(mediaId: string, mediaAccessToken: string): string {
  return `${API_BASE_URL}/media/${mediaId}/content?token=${encodeURIComponent(mediaAccessToken)}`;
}

export type { MediaKind };
