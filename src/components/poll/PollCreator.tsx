"use client";

import { useState } from "react";
import { usePollStore } from "@/store/usePollStore";
import { Toggle } from "@/components/ui/Toggle";

const DEFAULT_DURATION = 60;
const MAX_OPTIONS = 6;

export function PollCreator() {
  const { poll, startPoll, endCurrentPoll } = usePollStore();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [uniqueVotes, setUniqueVotes] = useState(true);

  const isActive = poll?.status === "active";

  function addOption() {
    if (options.length < MAX_OPTIONS) setOptions([...options, ""]);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
  }

  function updateOption(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    setOptions(next);
  }

  function handleStart() {
    const labels = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || labels.length < 2) return;
    startPoll(question.trim(), labels, duration, uniqueVotes);
  }

  if (isActive) {
    return (
      <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700">
        <p className="text-zinc-400 text-sm mb-3">Poll em andamento</p>
        <p className="text-white font-semibold text-lg mb-4">{poll.question}</p>
        <button
          onClick={endCurrentPoll}
          className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
        >
          Encerrar poll agora
        </button>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-700 space-y-4">
      <h2 className="text-white font-semibold text-lg">Nova Poll</h2>

      <div>
        <label className="text-zinc-400 text-xs uppercase tracking-wide mb-1 block">
          Pergunta
        </label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Qual a melhor opção?"
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="space-y-2">
        <label className="text-zinc-400 text-xs uppercase tracking-wide block">
          Opções — chat digita 1, 2, 3… ou A, B, C…
        </label>
        {options.map((opt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <span className="text-zinc-500 text-sm w-5 shrink-0">{i + 1}.</span>
            <input
              type="text"
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Opção ${i + 1}`}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            {options.length > 2 && (
              <button
                onClick={() => removeOption(i)}
                className="text-zinc-500 hover:text-red-400 transition-colors text-sm px-2"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <button
            onClick={addOption}
            className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors"
          >
            + Adicionar opção
          </button>
        )}
      </div>

      <div>
        <label className="text-zinc-400 text-xs uppercase tracking-wide mb-1 block">
          Duração (segundos)
        </label>
        <div className="flex gap-2">
          {[30, 60, 120, 300].map((s) => (
            <button
              key={s}
              onClick={() => setDuration(s)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                duration === s
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {s >= 60 ? `${s / 60}min` : `${s}s`}
            </button>
          ))}
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            min={10}
            max={3600}
            className="w-20 bg-zinc-800 border border-zinc-600 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-zinc-300 text-sm font-medium">Votos únicos por pessoa</p>
          <p className="text-zinc-500 text-xs">
            {uniqueVotes
              ? "Cada espectador vota só uma vez"
              : "Espectadores podem votar quantas vezes quiserem"}
          </p>
        </div>
        <Toggle
          enabled={uniqueVotes}
          onChange={setUniqueVotes}
          title={uniqueVotes ? "Votos únicos ativados" : "Votos únicos desativados"}
        />
      </div>

      <button
        onClick={handleStart}
        disabled={!question.trim() || options.filter((o) => o.trim()).length < 2}
        className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors"
      >
        Iniciar Poll
      </button>
    </div>
  );
}
