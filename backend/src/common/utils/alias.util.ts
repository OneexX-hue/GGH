import { randomInt } from 'crypto';

// Небольшой встроенный словарь (без внешней зависимости) — псевдоним
// участника в чате, см. docs/DECISIONS.md "Псевдонимная личность в
// чате". Численный суффикс отвечает за уникальность (проверяется на
// стороне вызывающего кода через unique-констрейнт User.chatAlias).
const ADJECTIVES = [
  'Тихий',
  'Скрытый',
  'Быстрый',
  'Ночной',
  'Осторожный',
  'Незаметный',
  'Дальний',
  'Молчаливый',
  'Внимательный',
  'Хитрый',
];

const NOUNS = [
  'Ястреб',
  'Волк',
  'Лис',
  'Рысь',
  'Сокол',
  'Барс',
  'Ворон',
  'Филин',
  'Койот',
  'Гепард',
];

export function generateChatAlias(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  const suffix = randomInt(1000, 10000);
  return `${adjective} ${noun}-${suffix}`;
}
