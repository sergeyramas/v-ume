import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Top({ end }: { end?: ReactNode }) {
  return (
    <header className="top">
      <div className="top-in">
        <Link to="/" className="mark">
          В уме
        </Link>
        <nav aria-label="Разделы">
          <Link to="/" activeOptions={{ exact: true }}>
            Путь
          </Link>
          <Link to="/flow">Поток</Link>
        </nav>
        {end && <div className="end">{end}</div>}
      </div>
    </header>
  );
}

// записи вида «87 + 100 = 187» и «98 → 100 − 2» не рвём переносом и выделяем
const EXPR = /(\d+(?:\s?[+−]\s?\d+)*\s?=\s?\d+|−?\s?\d+ → −?\s?\d+(?:\s[+−]\s\d+)+)/g;

export function Say({ text, bold = true }: { text: string; bold?: boolean }) {
  const parts = text.split(EXPR);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          bold ? (
            <b key={i} className="nw">
              {p}
            </b>
          ) : (
            <span key={i} className="nw">
              {p}
            </span>
          )
        ) : (
          p
        ),
      )}
    </>
  );
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Подпись ступени помощи. */
export const HELP_LABEL = ["сам", "с приёмом", "с шагом", "с ответом"] as const;

export function Levels({ help }: { help: number }) {
  return (
    <div className="end" aria-label={`Помощь: ${HELP_LABEL[help]}`}>
      {HELP_LABEL.map((l, i) => (
        <span key={l} className={`stamp ${i < help ? "gone" : i === help ? "fill" : "off"}`}>
          {l}
        </span>
      ))}
    </div>
  );
}

/** Только цифры, не длиннее max. */
export const digits = (v: string, max = 5) => v.replace(/\D/g, "").slice(0, max);

/** Русское множественное: plural(5, ["число", "числа", "чисел"]) → «чисел». */
export const plural = (n: number, [one, few, many]: readonly [string, string, string]) => {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many;
};
