import { encodeTtlMarker, decodeTtlMarker } from './ttl-marker';

describe('ttl marker', () => {
  it('декодирует то, что закодировал encodeTtlMarker (round-trip)', () => {
    const marker = { expiresAt: '2026-08-12T12:00:00.000Z', body: 'Секретное сообщение' };
    expect(decodeTtlMarker(encodeTtlMarker(marker))).toEqual(marker);
  });

  it('возвращает null для сообщения без TTL', () => {
    expect(decodeTtlMarker('Обычное сообщение без таймера')).toBeNull();
  });

  it('возвращает null для маркера с повреждённым JSON', () => {
    expect(decodeTtlMarker('##CARCLUB_TTL##{broken')).toBeNull();
  });

  it('возвращает null, если в маркере отсутствует body или expiresAt', () => {
    const malformed = `##CARCLUB_TTL##${JSON.stringify({ expiresAt: '2026-08-12T12:00:00.000Z' })}`;
    expect(decodeTtlMarker(malformed)).toBeNull();
  });
});
