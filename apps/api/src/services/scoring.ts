import type { ScoreRow, Scoreboard } from '@workspace/core';
import type { AppContext } from '../context.ts';

type Row = Record<string, unknown>;

/**
 * Табло считается запросом к БД, а не накоплением счётчика в таблице команд.
 * Счётчик рано или поздно разъезжается с фактами (отмена зачёта, reset),
 * а сумма по журналу отправок всегда верна по определению.
 */
export function computeRows(ctx: AppContext, eventId: string): ScoreRow[] {
  const rows = ctx.db
    .prepare(
      `SELECT
         t.id   AS team_id,
         t.name AS team_name,
         COALESCE(s.solved_count, 0)  AS solved_count,
         COALESCE(s.task_points, 0)   AS task_points,
         COALESCE(q.quality_points, 0) AS quality_points,
         s.last_solved_at             AS last_solved_at
       FROM teams t
       LEFT JOIN (
         SELECT team_id,
                COUNT(*)             AS solved_count,
                SUM(points_awarded)  AS task_points,
                MAX(created_at)      AS last_solved_at
         FROM submissions
         WHERE status = 'accepted'
         GROUP BY team_id
       ) s ON s.team_id = t.id
       LEFT JOIN (
         SELECT c.team_id, SUM(qc.points) AS quality_points
         FROM quality_claims c
         JOIN quality_codes qc ON qc.id = c.quality_code_id
         GROUP BY c.team_id
       ) q ON q.team_id = t.id
       WHERE t.event_id = ?`,
    )
    .all(eventId) as Row[];

  const scored: ScoreRow[] = rows.map((row) => {
    const taskPoints = Number(row['task_points']);
    const qualityPoints = Number(row['quality_points']);
    return {
      teamId: String(row['team_id']),
      teamName: String(row['team_name']),
      solvedCount: Number(row['solved_count']),
      taskPoints,
      qualityPoints,
      totalPoints: taskPoints + qualityPoints,
      lastSolvedAt: row['last_solved_at'] === null || row['last_solved_at'] === undefined ? null : Number(row['last_solved_at']),
    };
  });

  // При равенстве очков выше та команда, что закрыла последнее задание раньше.
  scored.sort((a, b) => b.totalPoints - a.totalPoints || (a.lastSolvedAt ?? Infinity) - (b.lastSolvedAt ?? Infinity));

  return scored;
}

/**
 * Табло для выдачи наружу.
 *
 * Пока `published` не выставлен, строки не отдаются вовсе — не «занулены»,
 * а отсутствуют. Занулённое табло всё равно выдаёт состав команд и их число,
 * а пустое не выдаёт ничего.
 */
export function buildScoreboard(ctx: AppContext, eventId: string, published: boolean): Scoreboard {
  return {
    serverTime: Date.now(),
    published,
    rows: published ? computeRows(ctx, eventId) : [],
  };
}

export function teamTotal(ctx: AppContext, teamId: string): number {
  const tasks = ctx.db
    .prepare("SELECT COALESCE(SUM(points_awarded), 0) AS n FROM submissions WHERE team_id = ? AND status = 'accepted'")
    .get(teamId) as Row | undefined;
  const quality = ctx.db
    .prepare(
      `SELECT COALESCE(SUM(qc.points), 0) AS n
       FROM quality_claims c JOIN quality_codes qc ON qc.id = c.quality_code_id
       WHERE c.team_id = ?`,
    )
    .get(teamId) as Row | undefined;

  return Number(tasks?.['n'] ?? 0) + Number(quality?.['n'] ?? 0);
}

/** Идентификаторы заданий, уже закрытых командой. */
export function solvedTaskIds(ctx: AppContext, teamId: string): string[] {
  const rows = ctx.db
    .prepare("SELECT task_id FROM submissions WHERE team_id = ? AND status = 'accepted'")
    .all(teamId) as Row[];
  return rows.map((row) => String(row['task_id']));
}
