import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod/v4';
import {
  ApiError,
  ClaimQualityRequest,
  GameCommand,
  GameState,
  Player,
  QualityCode,
  QuestEvent,
  RegisterRequest,
  RegisterResponse,
  Scoreboard,
  SubmitCodeRequest,
  SubmitCodeResponse,
  Task,
  TaskUpsert,
  Team,
} from '@workspace/core';
import { toYaml } from './yaml.ts';

/**
 * OpenAPI генерируется ИЗ Zod-схем, а не пишется рядом с ними.
 *
 * Отступление от исходного ТЗ (там спека была источником правды, а клиент
 * генерировался из неё через Orval). Причина: рукописная спека неизбежно
 * расходится с кодом, который валидирует запросы, и расхождение всплывает
 * на игре. Здесь источник один — Zod: он же валидирует тела на сервере,
 * он же даёт типы клиентам, он же порождает спеку для внешних потребителей.
 */

const schemas = {
  QuestEvent,
  GameState,
  Team,
  Player,
  RegisterRequest,
  RegisterResponse,
  Task,
  TaskUpsert,
  SubmitCodeRequest,
  SubmitCodeResponse,
  ClaimQualityRequest,
  QualityCode,
  Scoreboard,
  GameCommand,
  ApiError,
};

const components = {
  schemas: Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema as z.ZodType, { target: 'openapi-3.0', io: 'output' }),
    ]),
  ),
  securitySchemes: {
    playerToken: {
      type: 'http',
      scheme: 'bearer',
      description: 'Токен игрока, выданный POST /api/register. Хранится в SecureStore / localStorage.',
    },
    adminToken: {
      type: 'apiKey',
      in: 'header',
      name: 'X-Admin-Token',
      description: 'Общий секрет организатора (переменная окружения ADMIN_TOKEN).',
    },
  },
};

const ref = (name: keyof typeof schemas) => ({ $ref: `#/components/schemas/${name}` });
const json = (name: keyof typeof schemas) => ({ 'application/json': { schema: ref(name) } });
const errorResponse = (description: string) => ({ description, content: json('ApiError') });

const slugParam = {
  name: 'slug',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Идентификатор события в URL.',
};

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Quest Platform API',
    version: '0.1.0',
    description:
      'API городского квеста. Один и тот же контракт обслуживает веб и мобильные приложения.\n\n' +
      'Все ответы, связанные со временем, содержат serverTime: клиент считает таймер относительно него, ' +
      'а не по часам устройства.',
  },
  servers: [{ url: 'http://localhost:8080', description: 'Разработка' }],
  paths: {
    '/health': {
      get: {
        summary: 'Проверка живости и текущее время сервера',
        security: [],
        responses: {
          '200': {
            description: 'Сервер работает',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { type: 'string' }, serverTime: { type: 'integer' } },
                },
              },
            },
          },
        },
      },
    },

    '/api/register': {
      post: {
        summary: 'Регистрация игрока и выдача токена',
        description:
          'Повторный вызов с тем же deviceId возвращает существующего игрока с новым токеном — ' +
          'переустановка приложения не теряет прогресс команды.',
        security: [],
        requestBody: { required: true, content: json('RegisterRequest') },
        responses: {
          '201': { description: 'Игрок создан', content: json('RegisterResponse') },
          '200': { description: 'Игрок уже был зарегистрирован на этом устройстве', content: json('RegisterResponse') },
          '404': errorResponse('Событие не найдено'),
          '409': errorResponse('Игра завершена, регистрация закрыта'),
        },
      },
    },

    '/api/me': {
      get: {
        summary: 'Текущий игрок и его команда',
        responses: { '200': { description: 'Игрок' }, '401': errorResponse('Токен недействителен') },
      },
    },

    '/api/game-state': {
      get: {
        summary: 'Состояние игры для авторизованного игрока',
        responses: { '200': { description: 'Состояние', content: json('GameState') } },
      },
    },

    '/api/events/{slug}/state': {
      get: {
        summary: 'Состояние игры без авторизации',
        security: [],
        parameters: [slugParam],
        responses: {
          '200': { description: 'Состояние', content: json('GameState') },
          '404': errorResponse('Событие не найдено'),
        },
      },
    },

    '/api/events/{slug}/scoreboard': {
      get: {
        summary: 'Табло результатов',
        security: [],
        parameters: [slugParam],
        responses: { '200': { description: 'Табло', content: json('Scoreboard') } },
      },
    },

    '/api/events/{slug}/stream': {
      get: {
        summary: 'Поток изменений (Server-Sent Events)',
        description:
          'text/event-stream. Сообщения вида {"type":"game-state"|"tasks-changed"|"scoreboard"} — сигнал ' +
          'перезапросить соответствующие данные. Клиенты без SSE опрашивают API раз в 30 секунд.',
        security: [],
        parameters: [slugParam],
        responses: { '200': { description: 'Открытый поток событий' } },
      },
    },

    '/api/tasks': {
      get: {
        summary: 'Задания глазами игрока',
        description: 'Поле code намеренно отсутствует: ответ не должен попадать на устройство до сдачи.',
        responses: {
          '200': {
            description: 'Задания и текущая сумма баллов команды',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    tasks: { type: 'array', items: ref('Task') },
                    totalPoints: { type: 'integer' },
                    serverTime: { type: 'integer' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/quality-codes': {
      get: {
        summary: 'Шкала оценки качества (баллы и подписи, без самих кодов)',
        responses: { '200': { description: 'Шкала' } },
      },
    },

    '/api/submissions/code': {
      post: {
        summary: 'Отправка кода задания',
        description:
          'Идемпотентно по idempotencyKey: повторная доставка из офлайн-очереди возвращает ' +
          'исходный результат и не начисляет баллы второй раз.',
        requestBody: { required: true, content: json('SubmitCodeRequest') },
        responses: {
          '200': { description: 'Результат проверки', content: json('SubmitCodeResponse') },
          '404': errorResponse('Задание не найдено'),
        },
      },
    },

    '/api/submissions/quality': {
      post: {
        summary: 'Отправка кода оценки качества',
        requestBody: { required: true, content: json('ClaimQualityRequest') },
        responses: { '200': { description: 'Результат', content: json('SubmitCodeResponse') } },
      },
    },

    '/api/admin/events/{slug}/command': {
      post: {
        summary: 'Управление игрой: start / pause / resume / stop / reset',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        requestBody: { required: true, content: json('GameCommand') },
        responses: {
          '200': { description: 'Новое состояние', content: json('GameState') },
          '400': errorResponse('Переход невозможен из текущего состояния'),
          '403': errorResponse('Неверный админский токен'),
        },
      },
    },

    '/api/admin/events/{slug}/tasks': {
      get: {
        summary: 'Задания с кодами и готовыми QR-строками',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        responses: { '200': { description: 'Задания' } },
      },
      post: {
        summary: 'Создать задание',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        requestBody: { required: true, content: json('TaskUpsert') },
        responses: { '201': { description: 'Создано' } },
      },
    },

    '/api/admin/events/{slug}/tasks/{taskId}': {
      put: {
        summary: 'Изменить задание',
        security: [{ adminToken: [] }],
        parameters: [slugParam, { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: json('TaskUpsert') },
        responses: { '200': { description: 'Изменено' } },
      },
      delete: {
        summary: 'Удалить задание',
        security: [{ adminToken: [] }],
        parameters: [slugParam, { name: 'taskId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Удалено' } },
      },
    },

    '/api/admin/events/{slug}/players': {
      get: {
        summary: 'Игроки события с признаком присутствия',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        responses: { '200': { description: 'Игроки' } },
      },
    },

    '/api/admin/events/{slug}/attempts': {
      get: {
        summary: 'Журнал попыток ввода кодов (анти-чит)',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        responses: { '200': { description: 'Попытки, свежие сверху' } },
      },
    },

    '/api/admin/events/{slug}/export.csv': {
      get: {
        summary: 'Выгрузка итогов в CSV',
        security: [{ adminToken: [] }],
        parameters: [slugParam],
        responses: { '200': { description: 'CSV-файл', content: { 'text/csv': {} } } },
      },
    },
  },
  components,
  security: [{ playerToken: [] }],
};

const outputPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml');
writeFileSync(outputPath, `# Сгенерировано из Zod-схем: pnpm run gen:openapi. Не редактировать вручную.\n${toYaml(spec)}`);
console.log(`[api-spec] записано ${outputPath}`);
