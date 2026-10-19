// Картинки под табло: «почти круглое», прыжки по числовой прямой, кубики.
// Пунктир — впереди, сплошная — пройдено, красная — то, о чём кадр.

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Pic } from "@/lib/v2/frames";

const C = {
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
  mute: "var(--mute)",
  red: "var(--red)",
  redInk: "var(--red-ink)",
  h: "var(--h)",
  t: "var(--t)",
  u: "var(--u)",
  line: "var(--line)",
};
const st = (stroke: string, width = 1, dash?: string): CSSProperties => ({ stroke, strokeWidth: width, fill: "none", strokeDasharray: dash });
const tx = (fill: string, size = 17, weight = 700): CSSProperties => ({ fill, fontSize: size, fontWeight: weight });

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function PicView({ pic }: { pic: Pic }) {
  const [ref, W] = useWidth();
  return (
    <div className="pic" ref={ref}>
      {pic.kind === "near" && <Near W={W} n={pic.n} R={pic.R} />}
      {pic.kind === "jumps" && (pic.jumps.length ? <Jumps W={W} {...pic} /> : <Ruler W={W} at={pic.from} />)}
      {pic.kind === "blocks" && <Blocks W={W} numbers={pic.numbers} focus={pic.focus} />}
    </div>
  );
}

/** От n до круглого R — всего несколько шагов. */
function Near({ W, n, R }: { W: number; n: number; R: number }) {
  const span = Math.abs(R - n);
  const lo = n < R ? Math.min(n, R - 10) - 1 : R - 1;
  const hi = n < R ? R + 1 : Math.max(n, R + 10) + 1;
  const step = hi - lo > 40 ? 5 : 1;
  const L = 24;
  const Rr = W - 24;
  const X = (v: number) => L + ((v - lo) / (hi - lo)) * (Rr - L);
  const Y = 104;
  const a = X(n);
  const b = X(R);
  const m = (a + b) / 2;
  const other = n < R ? R - 10 : R + 10;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return (
    <svg className="nl" viewBox={`0 0 ${W} 150`} role="img" aria-label={`Числовая прямая: от ${n} до ${R} всего ${span}`}>
      <line x1={4} y1={Y} x2={W - 4} y2={Y} style={st(C.ink2)} />
      {ticks.map((v) => (
        <line key={v} x1={X(v)} y1={Y - (v % 10 ? 5 : 10)} x2={X(v)} y2={Y + (v % 10 ? 5 : 10)} style={st(C.ink2, v % 10 ? 1 : 1.5)} />
      ))}
      <path d={`M${a} ${Y - 8} Q ${m} ${Y - 62} ${b} ${Y - 8}`} style={st(C.mute, 1.5, "5 5")} />
      <text x={m} y={Y - 44} textAnchor="middle" style={tx(C.ink, 16)}>
        всего {span}
      </text>
      <circle cx={a} cy={Y} r={6} style={{ fill: C.red }} />
      {other >= lo && other <= hi && Math.abs(X(other) - a) > 36 && (
        <text x={X(other)} y={Y + 32} textAnchor="middle" style={tx(C.mute, 16, 400)}>
          {other}
        </text>
      )}
      <text x={a} y={Y + 32} textAnchor="middle" style={tx(C.redInk)}>
        {n}
      </text>
      <text x={b} y={Y + 32} textAnchor="middle" style={tx(C.ink)}>
        {R}
      </text>
    </svg>
  );
}

/** Прыжки: подписи — длина прыжка, точки — где оказались. */
function Jumps({ W, from, jumps, done, cur }: { W: number; from: number; jumps: number[]; done: number; cur: number }) {
  const pts = jumps.reduce<number[]>((acc, j) => [...acc, acc.at(-1)! + j], [from]);
  const sorted = [...new Set(pts)].sort((x, y) => x - y);
  const L = 28;
  const R = W - 28;
  const MIN = Math.min(64, (R - L) / Math.max(1, sorted.length - 1));
  const lo = sorted[0];
  const hi = sorted.at(-1)!;
  let xs = sorted.map((v) => (hi === lo ? (L + R) / 2 : L + ((v - lo) / (hi - lo)) * (R - L)));
  for (let i = 1; i < xs.length; i++) xs[i] = Math.max(xs[i], xs[i - 1] + MIN);
  if (xs.length > 1) {
    const k = (R - L) / (xs.at(-1)! - L);
    xs = xs.map((x) => L + (x - L) * k);
  }
  const X = (v: number) => xs[sorted.indexOf(v)];
  const Y = 112;
  return (
    <svg className="nl" viewBox={`0 0 ${W} 150`} role="img" aria-label={`Числовая прямая: ${pts.join(" → ")}`}>
      <line x1={4} y1={Y} x2={W - 4} y2={Y} style={st(C.ink2)} />
      {jumps.map((j, i) => {
        const a = X(pts[i]);
        const b = X(pts[i + 1]);
        const h = Math.min(78, 26 + Math.abs(b - a) * 0.18);
        const state = i < done ? "done" : i === cur ? "cur" : "ahead";
        const col = state === "cur" ? C.red : state === "done" ? C.ink : C.mute;
        const s = st(col, state === "ahead" ? 1.5 : 2, state === "ahead" ? "5 5" : undefined);
        const mx = (a + b) / 2;
        const top = Y - h;
        const dir = b > a ? -1 : 1;
        return (
          <g key={i}>
            <path d={`M${a} ${Y - 4} Q ${mx} ${top - h * 0.55} ${b} ${Y - 4}`} style={s} />
            <path d={`M${b + dir * 7} ${Y - 12} L${b} ${Y - 4} L${b + dir * 9} ${Y - 2}`} style={{ ...s, strokeDasharray: undefined }} />
            <text x={mx} y={top - h * 0.3} textAnchor="middle" style={tx(state === "cur" ? C.redInk : state === "done" ? C.ink : C.mute)}>
              {j > 0 ? "+" : "−"}
              {Math.abs(j)}
            </text>
          </g>
        );
      })}
      {sorted.map((v) => {
        const reached = pts.some((p, i) => p === v && (i === 0 || i - 1 < done || i - 1 === cur));
        return (
          <g key={v}>
            <line x1={X(v)} y1={Y - 6} x2={X(v)} y2={Y + 6} style={st(C.ink, 1.5)} />
            <text x={X(v)} y={Y + 28} textAnchor="middle" style={tx(reached ? C.ink : C.mute, 17, reached ? 700 : 500)}>
              {v}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Дорожка без прыжков: числа по порядку, отмечено одно. */
function Ruler({ W, at }: { W: number; at: number }) {
  const vs = [-30, -20, -10, 0, 10, 20, 30].map((d) => at + d).filter((v) => v >= 0);
  const L = 28;
  const X = (i: number) => L + (i / (vs.length - 1)) * (W - 2 * L);
  const Y = 104;
  return (
    <svg className="nl" viewBox={`0 0 ${W} 150`} role="img" aria-label={`Числовая прямая: ${vs.join(", ")}`}>
      <line x1={4} y1={Y} x2={W - 4} y2={Y} style={st(C.ink2)} />
      {vs.map((v, i) => (
        <g key={v}>
          <line x1={X(i)} y1={Y - 8} x2={X(i)} y2={Y + 8} style={st(C.ink2, 1.5)} />
          {v === at && <circle cx={X(i)} cy={Y} r={6} style={{ fill: C.red }} />}
          <text x={X(i)} y={Y + 32} textAnchor="middle" style={tx(v === at ? C.redInk : C.mute, 16, v === at ? 700 : 400)}>
            {v}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Кубики: сотня — квадрат, десяток — палочка, единица — кубик. Цвета разрядов. */
function Blocks({ W, numbers, focus }: { W: number; numbers: number[]; focus?: number[] }) {
  const H = 112;
  const unit = 9;
  const groups = numbers.map((n) => {
    const h = Math.floor(n / 100);
    const t = Math.floor((n % 100) / 10);
    const u = n % 10;
    const w = h * (H * 0.62 + 6) + t * (unit + 4) + Math.ceil(u / 5) * (unit + 4);
    return { n, h, t, u, w: Math.max(w, 24) };
  });
  const GAP = 34;
  const total = groups.reduce((s, g) => s + g.w, 0) + GAP * (groups.length - 1);
  const vw = Math.max(W, total + 16);
  let x = (vw - total) / 2;
  const label = numbers.join(", ");
  return (
    <svg className="blocks" viewBox={`0 0 ${vw} 150`} role="img" aria-label={`Кубики: ${label}`} preserveAspectRatio="xMidYMid meet">
      {groups.map((g, gi) => {
        const x0 = x;
        const parts: React.ReactNode[] = [];
        let cx = x0;
        const big = H * 0.62;
        for (let i = 0; i < g.h; i++) {
          parts.push(<rect key={`h${i}`} x={cx} y={8 + H - big} width={big} height={big} style={{ fill: C.h, opacity: 0.9 }} />);
          cx += big + 6;
        }
        for (let i = 0; i < g.t; i++) {
          parts.push(<rect key={`t${i}`} x={cx} y={8} width={unit} height={H} style={{ fill: C.t }} />);
          cx += unit + 4;
        }
        for (let i = 0; i < g.u; i++) {
          const col = Math.floor(i / 5);
          const row = i % 5;
          parts.push(<rect key={`u${i}`} x={cx + col * (unit + 4)} y={8 + H - (row + 1) * (unit + 3)} width={unit} height={unit} style={{ fill: C.u }} />);
        }
        x += g.w + GAP;
        const hot = focus?.includes(gi);
        return (
          <g key={gi}>
            {parts}
            <text x={x0 + g.w / 2} y={144} textAnchor="middle" style={tx(hot ? C.redInk : C.ink, 16)}>
              {g.n}
            </text>
            {hot && <rect x={x0 - 6} y={2} width={g.w + 12} height={H + 12} rx={6} style={st(C.red, 2)} />}
          </g>
        );
      })}
    </svg>
  );
}
