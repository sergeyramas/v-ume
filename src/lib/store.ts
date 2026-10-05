import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Difficulty = "easy" | "mid" | "hard";

export type SlipMiss = {
  lessonId: string;
  list: string;
  given: string;
  answer: number;
  timedOut: boolean;
  steps: string[];
  at: number;
};

export type LessonStat = {
  attempts: number;
  passes: number;
  stars: number;
  bestErrors: number | null;
  lastCorrect: number;
  lastTotal: number;
  lastMisses: SlipMiss[];
};

type ProgressState = {
  difficulty: Difficulty;
  voice: boolean;
  sound: boolean;
  lessons: Record<string, LessonStat>;
  misses: SlipMiss[];
  seen: number;
  right: number;
  setDifficulty: (d: Difficulty) => void;
  toggleVoice: () => void;
  toggleSound: () => void;
  record: (entry: {
    lessonId: string;
    correct: number;
    total: number;
    passed: boolean;
    stars: number;
    misses: SlipMiss[];
  }) => void;
  reset: () => void;
};

const empty = {
  difficulty: "easy" as Difficulty,
  voice: false,
  sound: true,
  lessons: {} as Record<string, LessonStat>,
  misses: [] as SlipMiss[],
  seen: 0,
  right: 0,
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      ...empty,
      setDifficulty: (difficulty) => set({ difficulty }),
      toggleVoice: () => set((s) => ({ voice: !s.voice })),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
      record: ({ lessonId, correct, total, passed, stars, misses }) =>
        set((s) => {
          const prev = s.lessons[lessonId];
          const errors = total - correct;
          const stat: LessonStat = {
            attempts: (prev?.attempts ?? 0) + 1,
            passes: (prev?.passes ?? 0) + (passed ? 1 : 0),
            stars: Math.max(prev?.stars ?? 0, stars),
            bestErrors:
              passed && (prev?.bestErrors == null || errors < prev.bestErrors)
                ? errors
                : (prev?.bestErrors ?? null),
            lastCorrect: correct,
            lastTotal: total,
            lastMisses: misses,
          };
          return {
            lessons: { ...s.lessons, [lessonId]: stat },
            misses: [...misses, ...s.misses].slice(0, 40),
            seen: s.seen + total,
            right: s.right + correct,
          };
        }),
      reset: () =>
        set((s) => ({
          ...empty,
          difficulty: s.difficulty,
          voice: s.voice,
          sound: s.sound,
        })),
    }),
    { name: "v-ume-slips" },
  ),
);
