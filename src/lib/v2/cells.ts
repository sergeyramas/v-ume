// Строка табло → флажки. Чистая логика: тестируется в node.
// Пробел — пустой флажок. Цифры красятся по разрядам, знаки — серым.

export type Cell = { ch: string; cls: string };
/** Диапазон символов строки [from, to) — то, что обводит красная рамка. */
export type Range = [number, number];

export const BLANK: Cell = { ch: "", cls: "" };
const OPS = "+−=×-";

const placeCls = (len: number, i: number) => ["c-u", "c-t", "c-h"][len - 1 - i] ?? "c-h";

/** Символы строки в флажки, один символ — один флажок. */
export function cellsOf(str: string): Cell[] {
  const out: Cell[] = [];
  for (const t of str.match(/\d+|./gu) ?? []) {
    if (/^\d+$/.test(t)) [...t].forEach((d, i) => out.push({ ch: d, cls: placeCls(t.length, i) }));
    else if (t === " ") out.push(BLANK);
    else out.push({ ch: t, cls: OPS.includes(t) ? "c-op" : "" });
  }
  return out;
}

/** Группы, которые нельзя рвать между рядами: знак держится за следующее число, «=» — за ответ. */
export function groups(str: string): Range[] {
  const out: Range[] = [];
  let byOp = false;
  [...str].forEach((c, i) => {
    const cur = out.at(-1);
    const prev = str[i - 1] ?? "";
    if (OPS.includes(c)) {
      out.push([i, i + 1]);
      byOp = true;
    } else if (/\d/.test(c) && cur && (/\d/.test(prev) || byOp)) cur[1] = i + 1;
    else if (/\d/.test(c) || !cur) {
      out.push([i, i + 1]);
      byOp = false;
    } else cur[1] = i + 1; // пробел или буква — к текущей группе
  });
  return out;
}

export type Packed = { cols: number; rows: number; cells: Cell[]; pos: number[] };

/**
 * Раскладка строки в ряды по cols флажков без разрыва групп.
 * pos[i] — номер флажка (в сетке rows × cols) для символа i строки.
 * right — прижать к правому краю (Поток).
 */
export function pack(str: string, cols: number, rows: number, right = false): Packed {
  const cells = cellsOf(str);
  const lines: Range[] = [];
  for (const [a, b] of groups(str)) {
    const cur = lines.at(-1);
    if (cur && b - cur[0] <= cols) cur[1] = b;
    else lines.push([a, b]);
  }
  if (!lines.length) lines.push([0, 0]);
  const R = Math.max(rows, lines.length);
  const grid: Cell[] = Array.from({ length: R * cols }, () => BLANK);
  const pos: number[] = [];
  lines.forEach(([a, b], r) => {
    const off = right ? cols - (b - a) : 0;
    for (let i = a; i < b; i++) {
      const at = r * cols + off + (i - a);
      if (at >= (r + 1) * cols || at < r * cols) continue; // группа длиннее ряда — режем хвост
      grid[at] = cells[i];
      pos[i] = at;
    }
  });
  return { cols, rows: R, cells: grid, pos };
}

/** Сколько рядов нужно строке при cols флажков в ряду. */
export const rowsFor = (str: string, cols: number) => pack(str, cols, 1).rows;

/** Самая длинная неразрывная группа. */
export const longestGroup = (str: string) => groups(str).reduce((m, [a, b]) => Math.max(m, b - a), 0);

/** Диапазоны символов числа n в строке: «87+100−2», 100 → [[3, 6]]. Ищет целое число, не кусок. */
export function findNumber(str: string, n: number, from = 0): Range | null {
  const re = /\d+/g;
  re.lastIndex = from;
  for (let m = re.exec(str); m; m = re.exec(str)) if (+m[0] === n) return [m.index, m.index + m[0].length];
  return null;
}

/** Подпись для скринридера: «87 + 100 − 2». */
export const spoken = (str: string) => str.replace(/([+−=])/g, " $1 ").replace(/\s+/g, " ").trim();
