import { generateChatAlias } from './alias.util';

describe('generateChatAlias', () => {
  it('возвращает строку формата "Прилагательное Существительное-NNNN"', () => {
    const alias = generateChatAlias();
    expect(alias).toMatch(/^[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+-\d{4}$/);
  });

  it('не содержит реального имени пользователя — не принимает никаких аргументов', () => {
    expect(generateChatAlias).toHaveLength(0);
  });

  it('генерирует разные значения при повторных вызовах (не константа)', () => {
    const results = new Set(Array.from({ length: 20 }, () => generateChatAlias()));
    expect(results.size).toBeGreaterThan(1);
  });
});
