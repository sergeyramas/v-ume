// Разбор кадрами: табло, одна фраза, картинка, кнопки. Ниже — список кадров, как табло отправлений.

import { useEffect, useRef, useState } from "react";
import type { Frame } from "@/lib/v2/frames";
import { boardWidth } from "@/lib/v2/frames";
import { Board, CHECK } from "./board";
import { PicView } from "./pics";
import { pad2, Say } from "./ui";

type Props = {
  title: string;
  meta?: string;
  /** Подпись над списком кадров: пример. */
  caption?: string;
  frames: Frame[];
  doneLabel: string;
  onDone: () => void;
};

export function Player({ title, meta, caption, frames, doneLabel, onDone }: Props) {
  const [i, setI] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const f = frames[i];
  const last = i === frames.length - 1;
  const go = (k: number) => setI(Math.max(0, Math.min(frames.length - 1, k)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (last) onDone();
        else go(i + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="app" ref={root}>
      <div className="bar">
        <h3>{title}</h3>
        {meta && <span className="meta">{meta}</span>}
        <div className="end">
          <span className="meta">
            Кадр {i + 1} из {frames.length}
          </span>
        </div>
      </div>
      <div className="stage">
        <Board text={f.board} all={frames.map((x) => x.board)} n={boardWidth(frames)} lit={f.lit} />
        <p className="say" aria-live="polite">
          <Say text={f.say} />
        </p>
        <PicView pic={f.pic} />
        <div className="ctrl">
          <span className="hint keys">
            <kbd>←</kbd> <kbd>→</kbd> листать
          </span>
          <button type="button" className="btn" onClick={() => go(i - 1)} disabled={i === 0}>
            Назад
          </button>
          <button type="button" className="btn go" onClick={() => (last ? onDone() : go(i + 1))}>
            {last ? doneLabel : "Дальше"} <kbd>→</kbd>
          </button>
        </div>
      </div>
      <div className="sec-h">
        Кадры {caption && <span>{caption}</span>}
      </div>
      <div className="frames">
        <span className="hd c1">Кадр</span>
        <span className="hd c2">Что происходит</span>
        <span className="hd c3">Статус</span>
        {frames.map((x, k) => {
          const s = k < i ? "past" : k === i ? "cur" : "ahead";
          const end = k === frames.length - 1 ? " last" : "";
          return (
            <FrameRow key={k} k={k} s={s} end={end} say={x.say} onPick={() => go(k)} />
          );
        })}
      </div>
    </div>
  );
}

function FrameRow({ k, s, end, say, onPick }: { k: number; s: string; end: string; say: string; onPick: () => void }) {
  return (
    <>
      <span className={`c1 ${s}${end}`}>{pad2(k + 1)}</span>
      <button type="button" className={`c2 ${s}${end}`} onClick={onPick} aria-current={s === "cur" ? "step" : undefined}>
        <Say text={say} bold={false} />
      </button>
      <span className={`c3 ${s}${end}`}>{s === "cur" ? <span className="stamp now">сейчас</span> : s === "past" ? CHECK : null}</span>
    </>
  );
}
