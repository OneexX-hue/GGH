/** Десять заданий по умолчанию — чтобы после первого запуска игру можно было провести сразу. */
export interface SeedTask {
  title: string;
  description: string;
  code: string;
  points: number;
  qualityEnabled: boolean;
}

export const DEFAULT_TASKS: SeedTask[] = [
  { title: 'Старт', description: 'Найдите отметку на главной площади и введите код с таблички.', code: 'СТАРТ', points: 10, qualityEnabled: false },
  { title: 'Памятник', description: 'Сфотографируйтесь у памятника и найдите год на постаменте.', code: '1147', points: 10, qualityEnabled: true },
  { title: 'Библиотека', description: 'Код спрятан на стенде у входа в библиотеку.', code: 'КНИГА', points: 15, qualityEnabled: false },
  { title: 'Мост', description: 'Сосчитайте фонари на мосту — их число и есть код.', code: '24', points: 15, qualityEnabled: false },
  { title: 'Парк', description: 'Найдите старейшее дерево парка, код на табличке рядом.', code: 'ДУБ', points: 15, qualityEnabled: true },
  { title: 'Вокзал', description: 'Код указан на историческом стенде в зале ожидания.', code: 'РЕЛЬС', points: 20, qualityEnabled: false },
  { title: 'Театр', description: 'Афиша у входа хранит код этого этапа.', code: 'АНТРАКТ', points: 20, qualityEnabled: true },
  { title: 'Набережная', description: 'Спуститесь к воде и найдите отметку уровня реки.', code: 'ВОЛНА', points: 20, qualityEnabled: false },
  { title: 'Смотровая', description: 'Поднимитесь на смотровую площадку, код на ограждении.', code: 'ВЫСОТА', points: 25, qualityEnabled: false },
  { title: 'Финиш', description: 'Вернитесь к точке старта и сдайте маршрутный лист.', code: 'ФИНИШ', points: 30, qualityEnabled: true },
];

/** Три постоянных кода оценки качества, общие для всего события. */
export interface SeedQualityCode {
  code: string;
  points: number;
  label: string;
}

export const DEFAULT_QUALITY_CODES: SeedQualityCode[] = [
  { code: 'КАЧ10', points: 10, label: 'Отлично' },
  { code: 'КАЧ5', points: 5, label: 'Хорошо' },
  { code: 'КАЧ3', points: 3, label: 'Удовлетворительно' },
];
