// Путь: приёмы по порядку, как табло отправлений. Следующий к прохождению — красная метка «дальше».

import { createFileRoute, Link } from "@tanstack/react-router";
import { TECHNIQUES, type Technique } from "@/lib/engine/index.ts";
import { LADDER, type Age } from "@/lib/engine/flow.ts";
import { Board } from "@/components/v2/board";
import { pad2, plural, Top } from "@/components/v2/ui";
import { useHydrated, useStore, type TechState } from "@/lib/v2/store";

export const Route = createFileRoute("/")({ component: PathPage });

function PathPage() {
  const ok = useHydrated();
  const st = useStore();
  // до гидрации — как у нового ученика, чтобы разметка сервера и клиента совпала
  const techniques = ok ? st.techniques : {};
  const streak = ok ? st.days.streak : 0;
  const flowStep = ok ? st.flow.step.tens : 1;
  const done = TECHNIQUES.filter((t) => techniques[t.id]?.mastered).length;
  const next = TECHNIQUES.find((t) => !techniques[t.id]?.mastered);
  const levels = [1, 2] as const;

  return (
    <>
      <Top />
      <main className="wrap">
        <div className="path">
          <div className="col">
            <section className="app" aria-labelledby="h-hero">
              <div className="hero">
                <Board text="В УМЕ" n={5} max={88} label="В уме" />
                <h1 id="h-hero" className="sr-only">
                  В уме — тренажёр устного счёта
                </h1>
                <p>
                  Каждый приём сначала разбираем по кадрам, потом шесть задач. Подсказки берёшь сам: приём, первый шаг или ответ. В «Потоке»
                  числа идут по одному, а сумму держишь в голове.
                </p>
                {next && (
                  <div>
                    <Link to="/t/$id" params={{ id: next.id }} className="btn go">
                      {techniques[next.id]?.lessons.length ? "Продолжить" : "Начать"}: {next.title}
                    </Link>
                  </div>
                )}
              </div>
              <div className="stats">
                <div>
                  <b>{streak}</b>
                  <span>{plural(streak, ["день подряд", "дня подряд", "дней подряд"])}</span>
                </div>
                <div>
                  <b>
                    {done} из {TECHNIQUES.length}
                  </b>
                  <span>приёмов освоено</span>
                </div>
                <div>
                  <b>
                    {flowStep} из {LADDER.tens.length}
                  </b>
                  <span>ступень «Потока»</span>
                </div>
              </div>
            </section>

            {levels.map((lv) => (
              <section key={lv} className="app" aria-labelledby={`h-lv${lv}`}>
                <div className="bar">
                  <h3 id={`h-lv${lv}`}>{lv === 1 ? "Уровень 1 · база" : "Уровень 2 · посложнее"}</h3>
                  <span className="meta">{lv === 1 ? "Сложение двузначных и трёхзначных" : "Вычитание, цепочки и длинные списки"}</span>
                </div>
                <div className="rows">
                  {TECHNIQUES.filter((t) => t.level === lv).map((t) => (
                    <TechRow key={t.id} t={t} no={TECHNIQUES.indexOf(t) + 1} s={techniques[t.id]} next={t.id === next?.id} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="col">
            <section className="app" aria-labelledby="h-flow">
              <div className="bar">
                <h3 id="h-flow">Поток</h3>
                <span className="meta">
                  Ступень {flowStep} из {LADDER.tens.length}
                </span>
              </div>
              <div className="hero">
                <p>Числа появляются по одному на табло. Складывай в уме и назови итог. Получается — ступень растёт.</p>
                <div>
                  <Link to="/flow" className="btn go">
                    Открыть «Поток»
                  </Link>
                </div>
              </div>
            </section>
            <Settings ok={ok} />
          </aside>
        </div>
      </main>
    </>
  );
}

function TechRow({ t, no, s, next }: { t: Technique; no: number; s?: TechState; next: boolean }) {
  const stamp = s?.mastered ? (
    <span className="stamp fill">освоен</span>
  ) : next ? (
    <span className="stamp now">дальше</span>
  ) : s?.stars ? (
    <span className="stamp" aria-label={`звёзд: ${s.stars}`}>
      {"★".repeat(s.stars)}
    </span>
  ) : null;
  return (
    <Link to="/t/$id" params={{ id: t.id }} className={`row${next ? " cur" : ""}`}>
      <span className="no">{pad2(no)}</span>
      <span>
        <strong>{t.title}</strong>
        <small>{t.sign}</small>
      </span>
      {stamp ?? <span />}
    </Link>
  );
}

function Settings({ ok }: { ok: boolean }) {
  const age = useStore((s) => s.age);
  const slower = useStore((s) => s.slower);
  const setAge = useStore((s) => s.setAge);
  const setSlower = useStore((s) => s.setSlower);
  const a: Age = ok ? age : "9-11";
  return (
    <section className="app" aria-labelledby="h-set">
      <div className="bar">
        <h3 id="h-set">Настройки</h3>
      </div>
      <div className="hero" style={{ gap: 16 }}>
        <div className="set-row">
          <span id="age-l">Возраст</span>
          <div className="seg" role="group" aria-labelledby="age-l">
            {(["9-11", "12-15"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={a === v} onClick={() => setAge(v)}>
                {v.replace("-", "–")} лет
              </button>
            ))}
          </div>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={ok && slower} onChange={(e) => setSlower(e.target.checked)} />
          Помедленнее: в «Потоке» каждое число стоит на полсекунды дольше
        </label>
      </div>
    </section>
  );
}
