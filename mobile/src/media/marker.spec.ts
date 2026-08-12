import { encodeMediaMarker, decodeMediaMarker } from './marker';

describe('media marker', () => {
  it('декодирует то, что закодировал encodeMediaMarker (round-trip)', () => {
    const marker = { mediaId: 'media-1', kind: 'PHOTO' as const };
    expect(decodeMediaMarker(encodeMediaMarker(marker))).toEqual(marker);
  });

  it('возвращает null для обычного текстового сообщения', () => {
    expect(decodeMediaMarker('Привет всем')).toBeNull();
  });

  it('возвращает null для маркера с повреждённым JSON', () => {
    expect(decodeMediaMarker('##CARCLUB_MEDIA##{not valid json')).toBeNull();
  });

  it('возвращает null, если kind не PHOTO/VIDEO', () => {
    const malformed = `##CARCLUB_MEDIA##${JSON.stringify({ mediaId: 'm1', kind: 'AUDIO' })}`;
    expect(decodeMediaMarker(malformed)).toBeNull();
  });
});
