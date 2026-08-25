"use client";

import { useState } from "react";
import { SquarePlus, GripVertical, Trash2, Plus, Bookmark, Rocket } from "lucide-react";
import { usePollStore } from "@/store/usePollStore";
import { PollTemplate } from "@/lib/poll/types";
import { Toggle } from "@/components/ui/Toggle";
import { useTranslation } from "@/lib/i18n/useTranslation";

const DEFAULT_DURATION = 60;
const MAX_QUESTION_LENGTH = 120;
const MAX_OPTION_LENGTH = 60;
const DURATION_PRESETS = [30, 60, 120, 300, 600];

export function PollCreator({ prefill }: { prefill?: PollTemplate | null }) {
  const { t } = useTranslation();
  const { poll, startPoll, endCurrentPoll, saveTemplate, settings } = usePollStore();
  const maxOptions = settings.maxPollOptions;
  // PollCreator only ever mounts fresh with a prefill already set (the "Nova Poll" section
  // unmounts/remounts on navigation), so lazy initial state covers it — no sync-on-prop-change
  // effect needed.
  const [question, setQuestion] = useState(prefill?.question ?? "");
  const [options, setOptions] = useState(() => {
    if (!prefill) return ["", ""];
    return prefill.options.length >= 2 ? prefill.options : [...prefill.options, ""];
  });
  const [duration, setDuration] = useState(prefill?.durationSec ?? DEFAULT_DURATION);
  const [customDuration, setCustomDuration] = useState(
    prefill ? !DURATION_PRESETS.includes(prefill.durationSec) : false
  );
  const [uniqueVotes, setUniqueVotes] = useState(prefill?.uniqueVotes ?? true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const isActive = poll?.status === "active";

  function addOption() {
    if (options.length < maxOptions) setOptions([...options, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  }

  function updateOption(i: number, value: string) {
    const next = [...options];
    next[i] = value.slice(0, MAX_OPTION_LENGTH);
    setOptions(next);
  }

  function reorderOptions(from: number, to: number) {
    if (from === to) return;
    setOptions((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  const validLabels = options.map((o) => o.trim()).filter(Boolean);
  const isValid = !!question.trim() && validLabels.length >= 2;

  function handleStart() {
    if (!isValid) return;
    startPoll(question.trim(), validLabels, duration, uniqueVotes);
  }

  function handleSaveTemplate() {
    if (!isValid) return;
    saveTemplate({ question: question.trim(), options: validLabels, durationSec: duration, uniqueVotes });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (isActive) {
    return (
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700">
        <p className="text-zinc-400 text-sm mb-3">{t("pollCreator.pollEmAndamento")}</p>
        <p className="text-white font-semibold text-lg mb-4">{poll.question}</p>
        <button
          onClick={endCurrentPoll}
          className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
        >
          {t("pollCreator.encerrarAgora")}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg border border-indigo-500/50 text-indigo-400 flex items-center justify-center shrink-0">
          <SquarePlus size={16} />
        </div>
        <h2 className="text-white font-semibold text-lg">{t("pollCreator.criarNovaPoll")}</h2>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-zinc-400 text-xs uppercase tracking-wide">{t("pollCreator.pergunta")}</label>
          <span className="text-zinc-600 text-xs tabular-nums">
            {question.length}/{MAX_QUESTION_LENGTH}
          </span>
        </div>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
          maxLength={MAX_QUESTION_LENGTH}
          placeholder={t("pollCreator.perguntaPlaceholder")}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-zinc-400 text-xs uppercase tracking-wide block">
          {t("pollCreator.opcoesLabel", { max: maxOptions })}
        </label>
        {options.map((opt, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) reorderOptions(dragIndex, i);
              setDragIndex(null);
            }}
            className="flex gap-2 items-center"
          >
            <span className="text-zinc-600 cursor-grab active:cursor-grabbing shrink-0">
              <GripVertical size={16} />
            </span>
            <span className="text-zinc-500 text-sm w-5 shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              maxLength={MAX_OPTION_LENGTH}
              placeholder={t("pollCreator.opcaoPlaceholder", { n: i + 1 })}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(i)}
                className="text-zinc-500 hover:text-red-400 transition-colors p-1"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
        {options.length < maxOptions && (
          <button
            onClick={addOption}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-zinc-700 text-indigo-400 hover:text-indigo-300 hover:border-indigo-500/50 text-sm transition-colors"
          >
            <Plus size={15} />
            {t("pollCreator.adicionarOpcao")}
          </button>
        )}
      </div>

      <div>
        <label className="text-zinc-400 text-xs uppercase tracking-wide mb-1 block">{t("pollCreator.duracao")}</label>
        <div className="flex flex-wrap gap-2">
          {DURATION_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setDuration(s);
                setCustomDuration(false);
              }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                !customDuration && duration === s
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s >= 60 ? `${s / 60}min` : `${s}s`}
            </button>
          ))}
          <button
            onClick={() => setCustomDuration(true)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              customDuration ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {t("pollCreator.personalizado")}
          </button>
        </div>
        {customDuration && (
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={10}
            max={3600}
            className="mt-2 w-28 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-zinc-300 text-sm font-medium">{t("pollCreator.votosUnicosTitulo")}</p>
          <p className="text-zinc-500 text-xs">
            {uniqueVotes ? t("pollCreator.votosUnicosOn") : t("pollCreator.votosUnicosOff")}
          </p>
        </div>
        <Toggle
          enabled={uniqueVotes}
          onChange={setUniqueVotes}
          title={uniqueVotes ? t("pollCreator.votosUnicosAtivados") : t("pollCreator.votosUnicosDesativados")}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSaveTemplate}
          disabled={!isValid}
          title={t("pollCreator.salvarModeloTitle")}
          className="shrink-0 px-3 rounded-lg border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 text-sm"
        >
          <Bookmark size={15} />
          {saved ? t("common.salvo") : t("common.salvar")}
        </button>
        <button
          onClick={handleStart}
          disabled={!isValid}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
        >
          <Rocket size={16} />
          {t("pollCreator.iniciarPoll")}
        </button>
      </div>
    </div>
  );
}
