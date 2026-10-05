const ONES = [
  "",
  "один",
  "два",
  "три",
  "четыре",
  "пять",
  "шесть",
  "семь",
  "восемь",
  "девять",
];
const TEENS = [
  "десять",
  "одиннадцать",
  "двенадцать",
  "тринадцать",
  "четырнадцать",
  "пятнадцать",
  "шестнадцать",
  "семнадцать",
  "восемнадцать",
  "девятнадцать",
];
const TENS = [
  "",
  "",
  "двадцать",
  "тридцать",
  "сорок",
  "пятьдесят",
  "шестьдесят",
  "семьдесят",
  "восемьдесят",
  "девяносто",
];
const HUNDREDS = [
  "",
  "сто",
  "двести",
  "триста",
  "четыреста",
  "пятьсот",
  "шестьсот",
  "семьсот",
  "восемьсот",
  "девятьсот",
];

function plural(n: number, one: string, few: string, many: string) {
  const a = n % 10;
  const b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}

function underThousand(n: number, feminine: boolean): string {
  if (n === 0) return "";
  const parts: string[] = [];
  parts.push(HUNDREDS[Math.floor(n / 100)] ?? "");
  const rest = n % 100;
  if (rest >= 20) {
    parts.push(TENS[Math.floor(rest / 10)] ?? "");
    const o = rest % 10;
    if (o) parts.push(feminine && o === 1 ? "одна" : feminine && o === 2 ? "две" : ONES[o] ?? "");
  } else if (rest >= 10) {
    parts.push(TEENS[rest - 10] ?? "");
  } else if (rest > 0) {
    parts.push(feminine && rest === 1 ? "одна" : feminine && rest === 2 ? "две" : ONES[rest] ?? "");
  }
  return parts.filter(Boolean).join(" ");
}

export function numberToRu(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (n < 0) return `минус ${numberToRu(-n)}`;
  if (n === 0) return "ноль";
  if (n >= 1_000_000) return String(n);
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (thousands) {
    const word = underThousand(thousands, true);
    parts.push(`${word} ${plural(thousands, "тысяча", "тысячи", "тысяч")}`);
  }
  if (rest) parts.push(underThousand(rest, false));
  return parts.join(" ");
}

export function fmt(n: number): string {
  const abs = Math.abs(Math.trunc(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return n < 0 ? `−${abs}` : abs;
}
