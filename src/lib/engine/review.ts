// Повторение (Лейтнер по типам задач), зачёт урока и освоение приёма.

import type { Help, TechniqueId, Tier } from "./types.ts";

/** Тип карточки: «nearUp:2» или «flow:tens:5». */
export const cardType = (technique: TechniqueId, tier: Tier) => `${technique}:${tier}`;
export const flowCardType = (branch: string, step: number) => `flow:${branch}:${step}`;

export type Card = { box: 1 | 2 | 3 | 4; due: string };

/** Через сколько дней снова: коробка 1 — в этой же сессии. */
export const INTERVAL: Record<Card["box"], number> = { 1: 0, 2: 1, 3: 3, 4: 7 };

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Засчитывается только самостоятельный ответ или ответ после подсказки-приёма. */
export const credited = (correct: boolean, help: Help) => correct && help <= 1;

/**
 * Ответ по карточке:
 * - ошибка или «показать решение» → коробка 1;
 * - подсказка «первый шаг» → коробка та же, срок по ней;
 * - сам / с приёмом → следующая коробка; после 4-й карточка снята (null).
 */
export function review(card: Card | undefined, correct: boolean, help: Help, today: string): Card | null {
  const box = card?.box ?? 1;
  let next: Card["box"];
  if (!correct || help === 3) next = 1;
  else if (help === 2) next = box;
  else {
    if (box === 4) return null;
    next = (box + 1) as Card["box"];
  }
  return { box: next, due: addDays(today, INTERVAL[next]) };
}

/** Что повторить сегодня: просроченные — сначала самые старые, максимум limit. Пропуск дней ничего не ломает. */
export function dueToday(cards: Record<string, Card>, today: string, limit = 6): string[] {
  return Object.entries(cards)
    .filter(([, c]) => c.due <= today)
    .sort(([ka, a], [kb, b]) => a.due.localeCompare(b.due) || a.box - b.box || ka.localeCompare(kb))
    .slice(0, limit)
    .map(([k]) => k);
}

/** Звёзды за урок из 6 задач: 6 засчитано — 3, 5 — 2, 4 — 1. */
export const stars = (creditedCount: number) => (creditedCount >= 6 ? 3 : creditedCount === 5 ? 2 : creditedCount === 4 ? 1 : 0);

/** Приём освоен: два последних урока подряд с ≥ 5 из 6 засчитанных. */
export function mastered(lessons: Array<{ credited: number }>) {
  const last = lessons.slice(-2);
  return last.length === 2 && last.every((l) => l.credited >= 5);
}

/** Пропустить разбор/«допиши»: два последних ответа засчитаны. */
export const skipGuided = (recent: Array<{ correct: boolean; help: Help }>) =>
  recent.length >= 2 && recent.slice(-2).every((r) => credited(r.correct, r.help));

/** Близнец задачи, которую не решил сам: показать через 3 задачи в уроке, иначе — в разминку. */
export const TWIN_GAP = 3;
