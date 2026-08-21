"use client";

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 text-xs px-2.5 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
    >
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div>
        <p className="text-zinc-200 text-sm font-medium mb-1">{title}</p>
        <div className="text-zinc-400 text-sm space-y-1">{children}</div>
      </div>
    </div>
  );
}

export function OverlayGuide() {
  const [port, setPort] = useState(9898);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    invoke<number>("get_overlay_port")
      .then(setPort)
      .catch(() => {});
  }, []);

  const overlayUrl = `http://localhost:${port}`;

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🎬</span>
          <span className="text-white font-semibold text-sm">
            Configurar Overlay no OBS
          </span>
        </div>
        <span className="text-zinc-500 text-xs">{open ? "▲ Fechar" : "▼ Ver instruções"}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-zinc-800 pt-4">
          {/* URL destaque */}
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-zinc-400 text-xs mb-2">
              Endereço do overlay — copie e cole no OBS:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-indigo-300 font-mono text-sm select-all bg-zinc-900 px-3 py-2 rounded-md truncate">
                {overlayUrl}
              </code>
              <CopyButton text={overlayUrl} />
            </div>
          </div>

          {/* Passos */}
          <div className="space-y-4">
            <Step number={1} title="Abra o OBS Studio">
              <p>Certifique-se que o Poll Multistream está aberto e com uma poll ativa ou encerrada.</p>
            </Step>

            <Step number={2} title='Adicione uma "Browser Source"'>
              <p>
                Na seção <strong className="text-zinc-300">Fontes</strong>, clique em{" "}
                <strong className="text-zinc-300">+</strong> e escolha{" "}
                <strong className="text-zinc-300">Navegador</strong>{" "}
                (ou <em>Browser Source</em>).
              </p>
            </Step>

            <Step number={3} title="Cole o endereço">
              <p>
                No campo <strong className="text-zinc-300">URL</strong>, cole:
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <code className="text-indigo-300 font-mono text-xs bg-zinc-900 px-2 py-1 rounded">
                  {overlayUrl}
                </code>
                <CopyButton text={overlayUrl} />
              </div>
            </Step>

            <Step number={4} title="Configure o tamanho recomendado">
              <p>
                Largura: <strong className="text-zinc-300">420</strong> px &nbsp;|&nbsp;
                Altura: <strong className="text-zinc-300">300</strong> px
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                Você pode ajustar livremente depois de posicionar na tela.
              </p>
            </Step>

            <Step number={5} title="Ative o fundo transparente (opcional)">
              <p>
                Marque a opção{" "}
                <strong className="text-zinc-300">Usar fundo transparente</strong>{" "}
                para o overlay aparecer sem caixa preta — ideal para sobrepor à sua câmera ou jogo.
              </p>
            </Step>

            <Step number={6} title="Clique em OK e posicione na cena">
              <p>
                Arraste o overlay para onde quiser na cena. Ele atualiza automaticamente
                a cada voto recebido no chat.
              </p>
            </Step>
          </div>

          {/* Dicas */}
          <div className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
            <p className="text-zinc-300 text-xs font-semibold uppercase tracking-wide">
              Dicas
            </p>
            <ul className="text-zinc-400 text-xs space-y-1.5 list-none">
              <li>
                ✅ O overlay funciona enquanto o Poll Multistream estiver aberto no computador.
              </li>
              <li>
                ✅ Se o OBS perder a conexão, ele reconecta sozinho em até 2 segundos.
              </li>
              <li>
                ✅ Você pode abrir{" "}
                <a
                  href={overlayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 underline"
                >
                  {overlayUrl}
                </a>{" "}
                no navegador para prévia de como vai aparecer.
              </li>
              <li>
                ⚠️ A porta <strong className="text-zinc-300">{port}</strong> precisa estar
                livre no seu computador. Se não funcionar, reinicie o app.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
