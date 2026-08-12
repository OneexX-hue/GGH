import { cn } from './utils';

describe('cn', () => {
  it('объединяет несколько строк классов через пробел', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('отбрасывает falsy значения (условные классы)', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });

  it('разрешает конфликт tailwind-классов в пользу последнего', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});
