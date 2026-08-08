import { z } from 'zod/v4';

/**
 * Единственный источник правды для форм данных. Из этих схем выводятся:
 *  - типы на сервере и на клиентах (web + mobile),
 *  - runtime-валидация тел запросов,
 *  - OpenAPI-спека (lib/api-spec/src/generate.ts).
 */

export const Id = z.string().min(1).max(64);
export const Timestamp = z.number().int().nonnegative();

/* ------------------------------------------------------------------ event */

export const EventStatus = z.enum(['draft', 'running', 'paused', 'finished']);
export type EventStatus = z.infer<typeof EventStatus>;

export const QuestEvent = z.object({
  id: Id,
  name: z.string().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9-]{3,48}$/),
  status: EventStatus,
  durationMs: z.number().int().positive(),
  /** Момент нажатия «старт». null пока игра не запускалась. */
  startedAt: Timestamp.nullable(),
  /** Момент последней паузы. Не-null только когда status === 'paused'. */
  pausedAt: Timestamp.nullable(),
  /** Сумма всех завершённых пауз — вычитается из прошедшего времени. */
  totalPausedMs: z.number().int().nonnegative(),
  createdAt: Timestamp,
});
export type QuestEvent = z.infer<typeof QuestEvent>;

/**
 * Состояние игры, как его видит клиент. `serverTime` обязателен: клиент
 * никогда не доверяет собственным часам, а считает остаток относительно него.
 */
export const GameState = z.object({
  event: QuestEvent,
  serverTime: Timestamp,
  remainingMs: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export type GameState = z.infer<typeof GameState>;

/* ----------------------------------------------------------------- player */

export const Team = z.object({
  id: Id,
  eventId: Id,
  name: z.string().min(1).max(80),
  createdAt: Timestamp,
});
export type Team = z.infer<typeof Team>;

export const Player = z.object({
  id: Id,
  eventId: Id,
  teamId: Id,
  name: z.string().min(1).max(80),
  role: z.enum(['player', 'judge', 'organizer']),
  createdAt: Timestamp,
  lastSeenAt: Timestamp.nullable(),
});
export type Player = z.infer<typeof Player>;

export const RegisterRequest = z.object({
  eventSlug: z.string().min(1),
  playerName: z.string().trim().min(1).max(80),
  teamName: z.string().trim().min(1).max(80),
  /** Стабильный идентификатор устройства. Позволяет вернуться в игру после перезапуска. */
  deviceId: z.string().min(8).max(128),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

/**
 * Токен возвращается ровно один раз, при регистрации. Сервер хранит только его хеш.
 * Клиент кладёт его в SecureStore (mobile) / localStorage (web).
 */
export const RegisterResponse = z.object({
  token: z.string().min(32),
  player: Player,
  team: Team,
});
export type RegisterResponse = z.infer<typeof RegisterResponse>;

/* ------------------------------------------------------------------- task */

export const TaskVerification = z.enum(['code', 'photo']);
export type TaskVerification = z.infer<typeof TaskVerification>;

/** Задание глазами игрока: без `code`, иначе ответ утекает в devtools. */
export const Task = z.object({
  id: Id,
  eventId: Id,
  orderIndex: z.number().int().nonnegative(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000),
  points: z.number().int().nonnegative(),
  verification: TaskVerification,
  /** Гео-проверка: код принимается только в радиусе. null — проверка выключена. */
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  radiusM: z.number().int().positive().nullable(),
  qualityEnabled: z.boolean(),
});
export type Task = z.infer<typeof Task>;

/** То же задание глазами админа — с ответом. */
export const AdminTask = Task.extend({ code: z.string().nullable() });
export type AdminTask = z.infer<typeof AdminTask>;

export const TaskUpsert = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).default(''),
  code: z.string().trim().min(1).max(64).nullable().default(null),
  points: z.number().int().nonnegative().default(10),
  verification: TaskVerification.default('code'),
  orderIndex: z.number().int().nonnegative().optional(),
  lat: z.number().min(-90).max(90).nullable().default(null),
  lng: z.number().min(-180).max(180).nullable().default(null),
  radiusM: z.number().int().positive().nullable().default(null),
  qualityEnabled: z.boolean().default(false),
});
export type TaskUpsert = z.infer<typeof TaskUpsert>;

/* ------------------------------------------------------------ submission */

export const SubmissionStatus = z.enum(['accepted', 'rejected', 'pending_review']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const Submission = z.object({
  id: Id,
  taskId: Id,
  teamId: Id,
  playerId: Id,
  status: SubmissionStatus,
  pointsAwarded: z.number().int(),
  createdAt: Timestamp,
});
export type Submission = z.infer<typeof Submission>;

export const Coords = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().optional(),
});
export type Coords = z.infer<typeof Coords>;

export const SubmitCodeRequest = z.object({
  taskId: Id,
  code: z.string().trim().min(1).max(64),
  /**
   * Ключ идемпотентности, генерируется клиентом. Офлайн-очередь может отправить
   * одну и ту же попытку несколько раз — сервер засчитает её ровно один раз.
   */
  idempotencyKey: z.uuid(),
  /** Момент ввода на устройстве. Сервер использует его только для аудита. */
  submittedAt: Timestamp.optional(),
  coords: Coords.optional(),
});
export type SubmitCodeRequest = z.infer<typeof SubmitCodeRequest>;

export const SubmitCodeResponse = z.object({
  status: SubmissionStatus,
  /** Причина отказа, если status === 'rejected'. */
  reason: z.enum(['wrong_code', 'already_solved', 'too_far', 'game_not_running', 'rate_limited']).nullable(),
  pointsAwarded: z.number().int(),
  totalPoints: z.number().int(),
  /** Расстояние до точки в метрах, когда отказ по гео. */
  distanceM: z.number().nonnegative().nullable(),
});
export type SubmitCodeResponse = z.infer<typeof SubmitCodeResponse>;

/* --------------------------------------------------------- quality codes */

/** Постоянные коды оценки качества: 10 / 5 / 3 балла. */
export const QualityCode = z.object({
  id: Id,
  eventId: Id,
  code: z.string(),
  points: z.number().int(),
  label: z.string(),
});
export type QualityCode = z.infer<typeof QualityCode>;

export const ClaimQualityRequest = z.object({
  code: z.string().trim().min(1).max(64),
  taskId: Id,
  idempotencyKey: z.uuid(),
});
export type ClaimQualityRequest = z.infer<typeof ClaimQualityRequest>;

/* ------------------------------------------------------------ scoreboard */

export const ScoreRow = z.object({
  teamId: Id,
  teamName: z.string(),
  solvedCount: z.number().int().nonnegative(),
  taskPoints: z.number().int(),
  qualityPoints: z.number().int(),
  totalPoints: z.number().int(),
  lastSolvedAt: Timestamp.nullable(),
});
export type ScoreRow = z.infer<typeof ScoreRow>;

export const Scoreboard = z.object({
  serverTime: Timestamp,
  rows: z.array(ScoreRow),
});
export type Scoreboard = z.infer<typeof Scoreboard>;

/* ----------------------------------------------------------------- admin */

export const GameCommand = z.object({
  action: z.enum(['start', 'pause', 'resume', 'stop', 'reset']),
  /** Длительность игры, применяется только при action === 'start'. */
  durationMs: z.number().int().positive().optional(),
});
export type GameCommand = z.infer<typeof GameCommand>;

/* ----------------------------------------------------------------- error */

export const ApiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
