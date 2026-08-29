/**
 * Минимальный сериализатор YAML для спеки.
 *
 * Полноценная библиотека здесь избыточна: на вход подаётся только то, что вернул
 * JSON.stringify-совместимый объект — словари, массивы, строки, числа, булевы.
 * Зависимость ради этого тянуть незачем.
 */
export function toYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null\n';
  if (typeof value === 'boolean' || typeof value === 'number') return `${String(value)}\n`;
  if (typeof value === 'string') return `${quote(value)}\n`;

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    return value
      .map((item) => {
        const rendered = toYaml(item, indent + 1);
        return isScalar(item) || isEmptyCollection(rendered) ? `${pad}- ${rendered}` : `${pad}-\n${rendered}`;
      })
      .join('');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}\n';
    return entries
      .map(([key, item]) => {
        const rendered = toYaml(item, indent + 1);
        // Пустые {} и [] обязаны остаться на строке ключа: с переносом получается
        // не «пустое значение», а следующий узел документа.
        if (isScalar(item) || isEmptyCollection(rendered)) return `${pad}${quote(key)}: ${rendered}`;
        return `${pad}${quote(key)}:\n${rendered}`;
      })
      .join('');
  }

  return `${String(value)}\n`;
}

function isScalar(value: unknown): boolean {
  return value === null || (typeof value !== 'object' && typeof value !== 'undefined');
}

function isEmptyCollection(rendered: string): boolean {
  return rendered === '{}\n' || rendered === '[]\n';
}

/**
 * Ключи и значения берутся в кавычки, когда без них YAML прочитается иначе:
 * пути вроде `/api/tasks`, коды статусов `200`, слова `yes`/`no`/`null`,
 * а также всё с двоеточиями и переводами строк.
 */
function quote(value: string): string {
  const needsQuotes =
    value === '' ||
    /^[\s-]|[:#]|[\n"']|\s$/.test(value) ||
    /^[0-9.]+$/.test(value) ||
    ['true', 'false', 'null', 'yes', 'no', 'on', 'off', '~'].includes(value.toLowerCase());

  if (!needsQuotes) return value;
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}
