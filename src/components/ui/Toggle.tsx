"use client";

export function Toggle({
  enabled,
  onChange,
  disabled,
  title,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      title={title}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none
        ${enabled ? "bg-indigo-600" : "bg-zinc-700"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform
          ${enabled ? "translate-x-4.5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
