import { API_BASE_URL, apiFetch } from './api';

export class LprApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface LprSubmissionResult {
  id: string;
  detectedPlate: string | null;
  confidence: number | null;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
  points: number | null;
  createdAt: string;
  reviewedAt: string | null;
}

// Отправляет фото номера в backend/src/modules/lpr — распознавание идёт
// через стороннее платное API (см. docs/DECISIONS.md, "LPR — бюджетный
// путь"), не на устройстве.
export async function submitLprPhoto(
  fileUri: string,
  mimeType: string,
  fileName: string,
  authToken: string,
): Promise<LprSubmissionResult> {
  const form = new FormData();
  form.append('file', { uri: fileUri, type: mimeType, name: fileName } as unknown as Blob);

  const response = await fetch(`${API_BASE_URL}/lpr/submissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new LprApiError(response.status, body.message ?? 'Не удалось отправить фото');
  }

  return response.json() as Promise<LprSubmissionResult>;
}

export async function listMyLprSubmissions(authToken: string): Promise<LprSubmissionResult[]> {
  return apiFetch<LprSubmissionResult[]>('/lpr/submissions/mine', { token: authToken });
}
