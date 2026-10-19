// Табло с перекидными флажками. React рисует сетку флажков, перещёлк — императивно (WAAPI),
// чтобы не перерисовывать дерево на каждый кадр анимации.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cellsOf, longestGroup, pack, rowsFor, spoken, type Cell, type Range } from "@/lib/v2/cells";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type TileEl = HTMLSpanElement & { _ch?: string; _cls?: string };

function paint(s: Element | null, c: Cell) {
  if (!s) return;
  s.textContent = c.ch;
  s.className = c.cls;
}

/** Перещёлк: верх старого падает, низ нового ложится с лёгким отскоком. */
function setCell(t: TileEl, c: Cell, delay: number) {
  const old: Cell = { ch: t._ch ?? "", cls: t._cls ?? "" };
  if (old.ch === c.ch && old.cls === c.cls) return;
  t._ch = c.ch;
  t._cls = c.cls;
  const up = t.querySelector(".h.up span");
  const dn = t.querySelector(".h.dn span");
  t.querySelectorAll(".f").forEach((f) => f.remove());
  if (reducedMotion() || typeof t.animate !== "function") {
    paint(up, c);
    paint(dn, c);
    return;
  }
  window.setTimeout(() => {
    if (t._ch !== c.ch || t._cls !== c.cls) return;
    paint(up, c);
    paint(dn, old);
    const fu = document.createElement("span");
    const fd = document.createElement("span");
    fu.className = "f up";
    fd.className = "f dn";
    fu.append(document.createElement("span"));
    fd.append(document.createElement("span"));
    paint(fu.firstChild as Element, old);
    paint(fd.firstChild as Element, c);
    t.append(fu, fd);
    fu.animate([{ transform: "rotateX(0)" }, { transform: "rotateX(-90deg)" }], { duration: 90, easing: "ease-in", fill: "forwards" });
    fd.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(-7deg)", offset: 0.78 }, { transform: "rotateX(0)" }], {
      duration: 90,
      delay: 90,
      easing: "ease-out",
      fill: "forwards",
    }).finished.then(
      () => {
        if (t._ch === c.ch && t._cls === c.cls) {
          paint(dn, c);
          fu.remove();
          fd.remove();
        }
      },
      () => {},
    );
  }, delay);
}

function useParentWidth(ref: React.RefObject<HTMLElement | null>) {
  const [w, setW] = useState<{ inner: number; small: boolean } | null>(null);
  useIso(() => {
    const p = ref.current?.parentElement;
    if (!p) return;
    const measure = () => {
      const ps = getComputedStyle(p);
      setW({ inner: p.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight), small: window.innerWidth <= 640 });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(p);
    return () => ro.disconnect();
  }, []);
  return w;
}

type Props = {
  text: string;
  /** Все строки, которые появятся на этом табло: размер и ряды считаются по ним, чтобы табло не прыгало. */
  all?: string[];
  /** Минимум флажков в ряду. */
  n?: number;
  lit?: Range[];
  max?: number;
  /** Ниже этой высоты флажка табло переходит в несколько рядов. */
  minTh?: number;
  right?: boolean;
  center?: boolean;
  label?: string;
  className?: string;
  children?: ReactNode;
};

export function Board({ text, all, n = 1, lit = [], max = 112, minTh = 48, right, center, label, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const tiles = useRef<TileEl[]>([]);
  const w = useParentWidth(ref);
  const texts = all?.length ? all : [text];
  const full = Math.max(n, ...texts.map((s) => [...s].length));

  const layout = useMemo(() => {
    if (!w) return { cols: full, rows: 1, th: 0 };
    const gap = w.small ? 4 : 6;
    const avail = w.inner - 2 - (w.small ? 16 : 24);
    const per = (k: number) => (avail - gap * (k - 1)) / k / 0.66;
    if (per(full) >= minTh) return { cols: full, rows: 1, th: Math.floor(Math.min(max, per(full))) };
    const fit = Math.floor((avail + gap) / (minTh * 0.66 + gap));
    const cols = Math.min(full, Math.max(fit, ...texts.map(longestGroup)));
    const rows = Math.max(...texts.map((s) => rowsFor(s, cols)));
    return { cols, rows, th: Math.floor(Math.min(max, per(cols))) };
    // texts меняются вместе с all/text — сравниваем по содержимому
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, full, max, minTh, texts.join("\n")]);

  const packed = useMemo(() => pack(text, layout.cols, layout.rows, right), [text, layout.cols, layout.rows, right]);
  const count = layout.cols * packed.rows;

  // флажки листаются только там, где символ поменялся
  useIso(() => {
    let k = 0;
    for (let i = 0; i < count; i++) {
      const t = tiles.current[i];
      if (!t) continue;
      const c = packed.cells[i];
      if ((t._ch ?? "") !== c.ch || (t._cls ?? "") !== c.cls) setCell(t, c, k++ * 28);
    }
  }, [packed, count]);

  // красная рамка: по одному прямоугольнику на ряд каждого диапазона
  const [rects, setRects] = useState<Array<{ left: number; top: number; width: number; height: number; side: boolean }>>([]);
  const litKey = JSON.stringify(lit);
  useIso(() => {
    const out: typeof rects = [];
    const p = 5;
    for (const [a, b] of lit) {
      const idx = Array.from({ length: b - a }, (_, i) => packed.pos[a + i]).filter((x) => x != null);
      const byRow = new Map<number, number[]>();
      for (const i of idx) byRow.set(Math.floor(i / layout.cols), [...(byRow.get(Math.floor(i / layout.cols)) ?? []), i]);
      for (const row of byRow.values()) {
        const first = tiles.current[Math.min(...row)];
        const last = tiles.current[Math.max(...row)];
        if (!first || !last) continue;
        out.push({
          left: first.offsetLeft - p,
          top: first.offsetTop - p,
          width: last.offsetLeft + last.offsetWidth - first.offsetLeft + p * 2,
          height: first.offsetHeight + p * 2,
          side: first.offsetTop > 20,
        });
      }
    }
    setRects(out);
  }, [litKey, packed, layout.th]);

  const cells: ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    if (i && i % layout.cols === 0) cells.push(<span key={`br${i}`} className="br" />);
    cells.push(
      <span
        key={i}
        className="tile"
        aria-hidden="true"
        ref={(el) => {
          if (el) tiles.current[i] = el;
        }}
      >
        <span className="h up">
          <span />
        </span>
        <span className="h dn">
          <span />
        </span>
      </span>,
    );
  }
  tiles.current.length = count;

  return (
    <div
      ref={ref}
      className={["board", center && "center", right && "right", className].filter(Boolean).join(" ")}
      role={children ? undefined : "img"}
      aria-label={children ? undefined : (label ?? (spoken(text) || "пусто"))}
      style={{ ["--th" as string]: layout.th ? `${layout.th}px` : undefined, opacity: layout.th ? undefined : 0 }}
    >
      {cells}
      {rects.map((r, i) => (
        <span
          key={i}
          className={`lit${i === 0 ? " lamp" : ""}${r.side ? " lamp-r" : ""}`}
          style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
        />
      ))}
      {children}
    </div>
  );
}

/** Маленькое табло для журнала: без анимации; зачёркнутое — ошибка, которая остаётся. */
export function MiniBoard({ text, struck, size = "sm" }: { text: string; struck?: boolean; size?: "sm" | "xs" }) {
  return (
    <span className={`board ${size}${struck ? " struck" : ""}`} role="img" aria-label={(struck ? "зачёркнуто " : "") + spoken(text)}>
      {cellsOf(text).map((c, i) => (
        <span key={i} className="tile" aria-hidden="true">
          <span className="h up">
            <span className={c.cls}>{c.ch}</span>
          </span>
          <span className="h dn">
            <span className={c.cls}>{c.ch}</span>
          </span>
        </span>
      ))}
    </span>
  );
}

export const CHECK = (
  <svg className="chk" viewBox="0 0 14 14" aria-hidden="true">
    <path d="M2 7.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>
);
