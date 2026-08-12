import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LprAdapter, LprNotConfiguredError, LprResult } from './lpr-adapter.interface';

// Plate Recognizer Snapshot API (api.platerecognizer.com) — публично
// задокументированный REST-эндпоинт стороннего платного сервиса (см.
// docs/DECISIONS.md — "LPR — бюджетный путь"). Аккаунт/ключ должен
// завести пользователь сам, Claude Code не регистрирует сторонние
// платные сервисы от чужого имени.
const ENDPOINT = 'https://api.platerecognizer.com/v1/plate-reader/';

interface PlateRecognizerResponse {
  results?: { plate?: string; score?: number }[];
}

@Injectable()
export class PlateRecognizerAdapter implements LprAdapter {
  constructor(private readonly config: ConfigService) {}

  async recognize(imageBuffer: Buffer): Promise<LprResult> {
    const apiKey = this.config.get<string>('LPR_API_KEY');
    if (!apiKey) throw new LprNotConfiguredError();

    const form = new FormData();
    form.append('upload', new Blob([Uint8Array.from(imageBuffer)]), 'plate.jpg');

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Plate Recognizer вернул ${response.status}: ${body}`);
    }

    const data = (await response.json()) as PlateRecognizerResponse;
    const best = data.results?.[0];
    if (!best?.plate) return { plate: null, confidence: null };

    return { plate: best.plate.toUpperCase(), confidence: best.score ?? null };
  }
}
