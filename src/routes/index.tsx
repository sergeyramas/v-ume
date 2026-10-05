import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Bell, BellOff, Lock, Star, Volume2, VolumeX } from "lucide-react";
import { LESSONS, lessonNo } from "@/lib/lessons";
import { useProgress, type Difficulty } from "@/lib/store";

export const Route = createFileRoute("/")({ component: Home });

const LEVELS: { id: Difficulty; title: string; note: string }[] = [
  { id: "easy", title: "Лёгкая", note: "9–11" },
  { id: "mid", title: "Средняя", note: "12–13" },
  { id: "hard", title: "Высокая", note: "14–15" },
];

function Home() {
  const difficulty = useProgress((s) => s.difficulty);
  const setDifficulty = useProgress((s) => s.setDifficulty);
  const lessons = useProgress((s) => s.lessons);
  const misses = useProgress((s) => s.misses);
  const seen = useProgress((s) => s.seen);
  const right = useProgress((s) => s.right);
  const voice = useProgress((s) => s.voice);
  const sound = useProgress((s) => s.sound);
  const toggleVoice = useProgress((s) => s.toggleVoice);
  const toggleSound = useProgress((s) => s.toggleSound);
  const reset = useProgress((s) => s.reset);
  const [armed, setArmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    const un = useProgress.persist.onFinishHydration(done);
    if (useProgress.persist.hasHydrated()) done();
    return un;
  }, []);

  const passed = (id: string) => (lessons[id]?.passes ?? 0) > 0;
  const open = LESSONS.map((lesson, index) => index === 0 || passed(LESSONS[index - 1]?.id ?? ""));
  const next = LESSONS.find((lesson, index) => open[index] && !passed(lesson.id)) ?? null;
  const doneCount = LESSONS.filter((lesson) => passed(lesson.id)).length;
  const accuracy = seen > 0 ? Math.round((right / seen) * 100) : 0;
  const chapters = [...new Set(LESSONS.map((lesson) => lesson.chapter))];

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">От 9 до 15 лет</p>
          <h1 className="font-display text-5xl font-semibold tracking-tight">В уме</h1>
        </div>
        <div className="flex gap-2">
          <IconButton label={voice ? "Выключить голос" : "Читать список вслух"} onClick={toggleVoice}>
        {voice ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </IconButton>
          <IconButton label={sound ? "Выключить звук плиты" : "Включить звук"} onClick={toggleSound}>
            {sound ? <Bell className="size-5" /> : <BellOff className="size-5" />}
          </IconButton>
        </div>
      </header>

      <p className="mt-4 max-w-xl text-pretty text-muted">
        Накладная из двузначных и трёхзначных. Одна текущая сумма, иногда одна пометка на полях.
        Так считает человек у ящика: калькулятор рядом чаще промахивается от спешки.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {LEVELS.map((level) => {
          const on = hydrated && difficulty === level.id;
          return (
            <button
              key={level.id}
              type="button"
              onClick={() => setDifficulty(level.id)}
              className={`min-h-14 rounded-2xl border px-2 py-2 text-left ${on ? "border-sage bg-sage text-paper" : "border-line bg-paper text-ink"}`}
            >
              <span className="block text-sm font-semibold">{level.title}</span>
              <span className={`block text-xs ${on ? "text-sage-soft" : "text-muted"}`}>{level.note}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted">
        Сложность меняет длину списка и скорость плиты, не порядок уроков. Высокая — уже темп оптовика.
      </p>

      <section className="mt-6 grid grid-cols-3 gap-3 rounded-2xl border border-line px-3 py-4">
        <Stat k="Уроки" v={hydrated ? `${doneCount}/${LESSONS.length}` : "—"} />
        <Stat k="Ошибки" v={hydrated ? String(Math.max(0, seen - right)) : "—"} />
        <Stat k="Точность" v={hydrated && seen ? `${accuracy}%` : "—"} />
      </section>

      {next ? (
        <Link
          to="/lesson/$id"
          params={{ id: next.id }}
          className="mt-4 flex min-h-14 items-center justify-between rounded-2xl bg-sage px-4 text-paper"
        >
          <span>
            <span className="block text-xs uppercase tracking-wide text-sage-soft">Дальше</span>
            <span className="font-display text-2xl">{next.title}</span>
          </span>
          <span className="text-sm">Урок {lessonNo(next.id)}</span>
        </Link>
      ) : null}

      <div className="mt-8 space-y-8">
        {chapters.map((chapter) => (
          <section key={chapter}>
            <h2 className="font-display text-2xl">{chapter}</h2>
            <ol className="mt-3 border-l-2 border-clay/40 pl-4">
              {LESSONS.filter((lesson) => lesson.chapter === chapter).map((lesson) => {
                const index = LESSONS.findIndex((item) => item.id === lesson.id);
                const unlocked = open[index];
                const stat = lessons[lesson.id];
                const body = (
                  <span className="flex items-center justify-between gap-3 py-3">
                    <span>
                      <span className="block text-xs text-muted">
                        {String(lessonNo(lesson.id)).padStart(2, "0")}
                      </span>
                      <span className="block font-semibold">{lesson.title}</span>
                    </span>
                    <span className="flex items-center gap-2 text-gold">
                      {unlocked ? <Stars n={stat?.stars ?? 0} /> : <Lock className="size-4 text-muted" />}
                    </span>
                  </span>
                );
                if (!unlocked) {
                  return (
                    <li key={lesson.id} className="border-b border-line text-muted">
                      {body}
                    </li>
                  );
                }
                return (
                  <li key={lesson.id} className="border-b border-line">
                    <Link to="/lesson/$id" params={{ id: lesson.id }} className="block">
                      {body}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Журнал промахов</h2>
        {!hydrated || misses.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Пока пусто. Ошибки и упавшая плита остаются здесь.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {misses.slice(0, 6).map((miss) => (
              <li key={`${miss.at}-${miss.list}`} className="rounded-2xl border border-line px-3 py-3">
                <p className="text-sm text-muted">{miss.timedOut ? "Плита" : "Не та сумма"}</p>
                <p className="mt-1 font-semibold tabular-nums">{miss.list}</p>
                <p className="text-sm tabular-nums">
                  Ответ {miss.given || "—"}, нужно {miss.answer}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8">
        {armed ? (
          <button type="button" className="text-sm text-clay" onClick={() => { reset(); setArmed(false); }}>
            Точно стереть звёзды и журнал
          </button>
        ) : (
          <button type="button" className="text-sm text-muted" onClick={() => setArmed(true)}>
            Сбросить прогресс
          </button>
        )}
      </div>
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="block text-xs uppercase tracking-wide text-muted">{k}</span>
      <span className="font-display text-2xl tabular-nums">{v}</span>
    </p>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex">
      {[0, 1, 2].map((i) => (
        <Star key={i} className={`size-4 ${i < n ? "fill-current text-gold" : "text-line"}`} />
      ))}
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-line bg-paper text-ink"
    >
      {children}
    </button>
  );
}
