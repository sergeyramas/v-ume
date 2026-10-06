import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import type { VisualExplanation, VisualStep } from "@/lib/explain";

type ExplainerProps = {
  explanation: VisualExplanation;
  variant: "intro" | "hint" | "reveal";
  initialOpen?: boolean;
};

export function VisualExplainer({
  explanation,
  variant,
  initialOpen = true,
}: ExplainerProps) {
  const [activeTab, setActiveTab] = useState<"primary" | "alt">("primary");
  const [stepIndex, setStepIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(initialOpen);

  const currentSteps =
    activeTab === "alt" && explanation.alternative
      ? explanation.alternative.steps
      : explanation.steps;

  const currentTitle =
    activeTab === "alt" && explanation.alternative
      ? explanation.alternative.title
      : explanation.title;

  // 1. Компактная подсказка во время игры (Hint)
  if (variant === "hint") {
    if (!isOpen) {
      return (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-sage/30 bg-sage-soft/30 px-3 py-2 text-left text-xs font-semibold text-sage transition hover:bg-sage-soft/60"
        >
          <span className="flex items-center gap-1.5">
            <Lightbulb className="size-4 text-gold" />
            <span>💡 Как упростить этот пример ({explanation.title})</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            Показать <ChevronDown className="size-3.5" />
          </span>
        </button>
      );
    }

    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-sage/40 bg-paper shadow-sm">
        <div className="flex items-center justify-between border-b border-line bg-sage-soft/35 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-sage text-paper">
              <Lightbulb className="size-3.5" />
            </span>
            <span className="text-xs font-bold text-sage">{explanation.title}</span>
            <span className="rounded-md bg-sage/10 px-1.5 py-0.5 text-[10px] font-semibold text-sage">
              {explanation.badge}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-1 text-xs text-muted hover:text-ink"
            aria-label="Скрыть подсказку"
          >
            <span>Скрыть</span>
            <ChevronUp className="size-3.5" />
          </button>
        </div>

        <div className="p-3">
          <p className="text-xs text-muted">{explanation.tagline}</p>
          <div className="mt-2.5 space-y-1.5">
            {explanation.steps.map((step, idx) => (
              <div
                key={`${step.label}-${idx}`}
                className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs ${
                  step.type === "result"
                    ? "bg-sage/10 font-bold text-sage"
                    : step.type === "sub"
                      ? "bg-clay-soft/40 text-clay"
                      : "bg-paper border border-line/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block size-1.5 rounded-full ${
                      step.type === "result"
                        ? "bg-sage"
                        : step.type === "sub"
                          ? "bg-clay"
                          : "bg-gold"
                    }`}
                  />
                  <span className="font-semibold">{step.label}</span>
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">{step.formula}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 2. Разбор ошибки (Reveal при неверном ответе или падении плиты)
  if (variant === "reveal") {
    return (
      <div className="mt-3 overflow-hidden rounded-2xl border border-clay/30 bg-clay-soft/30 p-3.5 text-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-full bg-clay text-paper">
            <Wand2 className="size-3.5" />
          </span>
          <p className="font-bold text-clay">Как нужно было упростить:</p>
        </div>
        <p className="mt-1 text-xs text-muted">{explanation.tagline}</p>

        <div className="mt-3 space-y-1.5">
          {explanation.steps.map((step, idx) => (
            <div
              key={`${step.label}-${idx}`}
              className="flex items-center justify-between rounded-xl border border-clay/20 bg-paper/80 px-3 py-1.5 text-xs"
            >
              <span className="font-medium text-ink">{step.label}</span>
              <span className="font-mono text-sm font-bold text-clay tabular-nums">
                {step.formula}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 3. Интерактивный визуальный тренажёр-объяснение для интро урока (Intro)
  return (
    <div className="mt-5 overflow-hidden rounded-3xl border-2 border-sage/25 bg-paper p-4 shadow-sm">
      {/* Шапка интерактивного разбора */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-sage text-paper">
            <Sparkles className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold leading-none">Секрет быстрого счёта</h3>
            <p className="mt-1 text-xs text-muted">Не считай в лоб — упрощай числа перед сложением</p>
          </div>
        </div>
        <span className="rounded-full border border-sage/30 bg-sage-soft px-2.5 py-1 text-xs font-bold text-sage">
          {explanation.badge}
        </span>
      </div>

      {/* Переключатель способов (если есть альтернативный) */}
      {explanation.alternative ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("primary");
              setStepIndex(0);
            }}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
              activeTab === "primary"
                ? "bg-sage text-paper shadow-xs"
                : "border border-line bg-paper/60 text-muted hover:text-ink"
            }`}
          >
            {explanation.title}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("alt");
              setStepIndex(0);
            }}
            className={`flex-1 rounded-xl py-1.5 text-xs font-semibold transition ${
              activeTab === "alt"
                ? "bg-sage text-paper shadow-xs"
                : "border border-line bg-paper/60 text-muted hover:text-ink"
            }`}
          >
            {explanation.alternative.title}
          </button>
        </div>
      ) : null}

      {/* Главный визуальный блок — схема трансформации числа */}
      <div className="mt-4 rounded-2xl border border-line bg-[#fdfbf7] p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-muted">
          Приём: {currentTitle}
        </p>

        {/* Наглядная цепочка блоков */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-display text-lg">
          {explanation.strategy === "round_hundred" ? (
            <RoundHundredDiagram />
          ) : (
            <StandardChainDiagram steps={currentSteps} />
          )}
        </div>

        <p className="mt-3 text-xs text-muted">
          {explanation.tagline}
        </p>
      </div>

      {/* Пошаговое интерактивное исследование для ребёнка */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold uppercase tracking-wider">Шаги в голове:</span>
          <span>
            Шаг {stepIndex + 1} из {currentSteps.length}
          </span>
        </div>

        {/* Кнопки переключения шагов */}
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {currentSteps.map((step, idx) => (
            <button
              key={`${step.label}-${idx}`}
              type="button"
              onClick={() => setStepIndex(idx)}
              className={`rounded-xl py-1.5 text-xs font-bold transition ${
                stepIndex === idx
                  ? "bg-sage text-paper shadow-xs"
                  : "border border-line bg-paper hover:bg-sage-soft/30"
              }`}
            >
              № {idx + 1}
            </button>
          ))}
        </div>

        {/* Карточка текущего выбранного шага */}
        {currentSteps[stepIndex] ? (
          <div className="mt-3 rounded-2xl border border-sage/30 bg-sage-soft/30 p-3 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sage">
                {currentSteps[stepIndex]!.label}
              </span>
              <span className="font-mono text-base font-bold text-sage tabular-nums">
                {currentSteps[stepIndex]!.formula}
              </span>
            </div>
            {currentSteps[stepIndex]!.note ? (
              <p className="mt-1 text-xs text-muted">
                💡 {currentSteps[stepIndex]!.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Краткий итог формулы */}
      <div className="mt-4 flex items-center justify-between rounded-xl bg-paper border border-line px-3 py-2 text-xs">
        <span className="text-muted">Итоговая цепочка:</span>
        <span className="font-mono font-bold text-ink">{explanation.summary}</span>
      </div>
    </div>
  );
}

/**
 * Красочная схема округления до 100:
 * [ 92 ]  +  [ 65 ]
 *    ↓ (+8)
 * [ 100 ] +  [ 65 ]  =  [ 165 ]
 *                          ↓ (−8)
 *                        [ 157 ]
 */
function RoundHundredDiagram() {
  return (
    <div className="w-full space-y-2 py-1">
      {/* Исходная строка */}
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-xl border border-line bg-paper px-3 py-1 font-bold shadow-xs">
          92
        </span>
        <span className="text-muted">+</span>
        <span className="rounded-xl border border-line bg-paper px-3 py-1 font-bold shadow-xs">
          65
        </span>
      </div>

      {/* Стрелка округления */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-sage font-semibold">
        <span>↓</span>
        <span className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px]">
          Округляем: 92 + 8 → 100
        </span>
      </div>

      {/* Сложение с сотней */}
      <div className="flex items-center justify-center gap-2">
        <span className="rounded-xl border-2 border-sage bg-sage text-paper px-3 py-1 font-bold shadow-xs">
          100
        </span>
        <span className="text-muted">+</span>
        <span className="rounded-xl border border-line bg-paper px-3 py-1 font-bold shadow-xs">
          65
        </span>
        <span className="text-muted">=</span>
        <span className="rounded-xl border border-line bg-paper px-3 py-1 font-bold shadow-xs">
          165
        </span>
      </div>

      {/* Стрелка компенсации */}
      <div className="flex items-center justify-center gap-1.5 text-xs text-clay font-semibold">
        <span>↓</span>
        <span className="rounded-full bg-clay-soft px-2 py-0.5 text-[11px]">
          Вычитаем добавку: 165 − 8
        </span>
      </div>

      {/* Результат */}
      <div className="flex items-center justify-center">
        <span className="flex items-center gap-1.5 rounded-2xl border-2 border-sage bg-sage/10 px-4 py-1.5 text-xl font-bold text-sage shadow-xs">
          <ArrowRight className="size-4" />
          <span>Ответ: 157</span>
        </span>
      </div>
    </div>
  );
}

/**
 * Стандартная интерактивная цепочка карточек
 */
function StandardChainDiagram({ steps }: { steps: VisualStep[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      {steps.map((step, idx) => (
        <div key={`${step.label}-${idx}`} className="flex items-center gap-1.5">
          <span
            className={`rounded-xl px-2.5 py-1 text-sm font-bold shadow-xs ${
              step.type === "result"
                ? "border-2 border-sage bg-sage text-paper"
                : step.type === "sub"
                  ? "border border-clay/40 bg-clay-soft/60 text-clay"
                  : "border border-line bg-paper"
            }`}
          >
            {step.formula}
          </span>
          {idx < steps.length - 1 ? (
            <ArrowRight className="size-3.5 text-muted/60" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
