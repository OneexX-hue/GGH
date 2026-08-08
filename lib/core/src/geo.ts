import type { Coords, Task } from './schemas.ts';

const EARTH_RADIUS_M = 6_371_000;

/** Расстояние по большому кругу (haversine), в метрах. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export interface GeoCheck {
  ok: boolean;
  distanceM: number | null;
}

/**
 * Проверка «игрок на точке».
 *
 * Погрешность GPS прибавляется к радиусу: в плотной застройке accuracy легко
 * доходит до 50 м, и без этой поблажки честные команды получают отказ.
 * Прибавка ограничена, иначе достаточно сообщить accuracy=10000 и стоять дома.
 */
const MAX_ACCURACY_ALLOWANCE_M = 75;

export function checkGeo(task: Pick<Task, 'lat' | 'lng' | 'radiusM'>, coords: Coords | undefined): GeoCheck {
  if (task.lat === null || task.lng === null || task.radiusM === null) {
    return { ok: true, distanceM: null }; // гео-проверка для задания выключена
  }
  if (!coords) {
    return { ok: false, distanceM: null }; // задание требует геолокации, а её не прислали
  }

  const d = distanceM(coords, { lat: task.lat, lng: task.lng });
  const allowance = Math.min(coords.accuracyM ?? 0, MAX_ACCURACY_ALLOWANCE_M);
  return { ok: d <= task.radiusM + allowance, distanceM: Math.round(d) };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
