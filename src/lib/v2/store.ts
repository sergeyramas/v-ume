// Прогресс «В уме» 2.0. Старый ключ v-ume-slips не читаем: другая модель данных.

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Help, TechniqueId, Tier } from "../engine/types.ts";
import { recordBest, type Age, type Branch } from "../engine/flow.ts";
import type { FoundationId } from "../engine/story.ts";
import { addDays, cardType, flowCardType, mastered, review, stars, type Card } from "../engine/review.ts";

export type LessonLog = { date: string; credited: number; total: number; shown: number };
export type TechState = { lessons: LessonLog[]; mastered: boolean; stars: number };
export type Result = { correct: boolean; help: Help };
export type Twin = { technique: TechniqueId; tier: Tier };
export type FlowRun = { date: string; branch: Branch; step: number; ok: boolean };

type State = {
  age: Age;
  slower: boolean;
  techniques: Partial<Record<TechniqueId, TechState>>;
  recent: Partial<Record<TechniqueId, Result[]>>;
  foundations: Partial<Record<FoundationId, true>>;
  twins: Twin[];
  leitner: Record<string, Card>;
  flow: { step: Record<Branch, number>; best: Record<string, number>; history: FlowRun[] };
  days: { streak: number; last: string | null };

  setAge: (a: Age) => void;
  setSlower: (v: boolean) => void;
  passFoundation: (id: FoundationId) => void;
  answer: (id: TechniqueId, tier: Tier, correct: boolean, help: Help) => void;
  finishLesson: (id: TechniqueId, log: Omit<LessonLog, "date">, twins: Twin[]) => void;
  flowResult: (branch: Branch, step: number, ok: boolean, nextStep: number) => void;
  reset: () => void;
};

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Серия дней: сегодня уже засчитан — без изменений; вчера был — +1; иначе заново. */
function touch(days: State["days"]): State["days"] {
  const t = today();
  if (days.last === t) return days;
  return { streak: days.last === addDays(t, -1) ? days.streak + 1 : 1, last: t };
}

const empty = {
  age: "9-11" as Age,
  slower: false,
  techniques: {},
  recent: {},
  foundations: {},
  twins: [],
  leitner: {},
  flow: { step: { tens: 1, hundreds: 1 }, best: {}, history: [] },
  days: { streak: 0, last: null },
} satisfies Partial<State>;

export const useStore = create<State>()(
  persist(
    (set) => ({
      ...empty,
      setAge: (age) => set({ age }),
      setSlower: (slower) => set({ slower }),
      passFoundation: (id) => set((s) => ({ foundations: { ...s.foundations, [id]: true } })),
      answer: (id, tier, correct, help) =>
        set((s) => {
          const key = cardType(id, tier);
          const card = review(s.leitner[key], correct, help, today());
          const leitner = { ...s.leitner };
          if (card) leitner[key] = card;
          else delete leitner[key];
          return {
            leitner,
            recent: { ...s.recent, [id]: [...(s.recent[id] ?? []), { correct, help }].slice(-5) },
            days: touch(s.days),
          };
        }),
      finishLesson: (id, log, twins) =>
        set((s) => {
          const prev = s.techniques[id] ?? { lessons: [], mastered: false, stars: 0 };
          const lessons = [...prev.lessons, { ...log, date: today() }].slice(-5);
          return {
            techniques: {
              ...s.techniques,
              [id]: { lessons, mastered: prev.mastered || mastered(lessons), stars: Math.max(prev.stars, stars(log.credited)) },
            },
            twins: [...s.twins, ...twins].slice(-30),
          };
        }),
      flowResult: (branch, step, ok, nextStep) =>
        set((s) => {
          const key = flowCardType(branch, step);
          const card = review(s.leitner[key], ok, 0, today());
          const leitner = { ...s.leitner };
          if (card) leitner[key] = card;
          else delete leitner[key];
          return {
            leitner,
            flow: {
              step: { ...s.flow.step, [branch]: nextStep },
              best: recordBest(s.flow.best, branch, step, ok),
              history: [...s.flow.history, { date: today(), branch, step, ok }].slice(-200),
            },
            days: touch(s.days),
          };
        }),
      reset: () => set(empty),
    }),
    { name: "v-ume-2", version: 1 },
  ),
);

/** До гидрации с localStorage рисуем как для нового ученика — так SSR и клиент совпадают. */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const done = () => setOk(true);
    const un = useStore.persist.onFinishHydration(done);
    if (useStore.persist.hasHydrated()) done();
    return un;
  }, []);
  return ok;
}

/** Лучшая пройденная ступень ветки (по всем классам). */
export const bestStep = (best: Record<string, number>, branch: Branch) =>
  Object.entries(best).reduce((m, [k, v]) => (k.startsWith(`${branch}:`) ? Math.max(m, v) : m), 0);
