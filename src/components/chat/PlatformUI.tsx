import { ConnectionStatus } from "@/store/usePollStore";

export function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected"
      ? "bg-green-500"
      : status === "connecting"
      ? "bg-yellow-400 animate-pulse"
      : status === "error"
      ? "bg-red-500"
      : "bg-zinc-600";
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

export function statusLabel(status: ConnectionStatus, connectedAs: string) {
  if (status === "connected") return connectedAs || "Conectado";
  if (status === "connecting") return "Conectando…";
  if (status === "error") return "Erro na conexão";
  return "Desconectado";
}

export function PlatformBadge({
  icon,
  className,
  size = "md",
}: {
  icon: React.ReactNode;
  className: string;
  size?: "md" | "lg";
}) {
  const dims = size === "lg" ? "w-11 h-11 rounded-xl" : "w-8 h-8 rounded-lg";
  return (
    <div className={`${dims} flex items-center justify-center text-white shrink-0 ${className}`}>
      {icon}
    </div>
  );
}
