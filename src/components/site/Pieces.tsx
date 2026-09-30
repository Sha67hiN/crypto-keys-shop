import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "cyan" | "teal" | "amber" | "rose" | "fog";

const toneClass: Record<Tone, string> = {
  cyan: "bg-cyan/10 text-cyan ring-cyan/30",
  teal: "bg-teal/10 text-teal ring-teal/30",
  amber: "bg-amber/10 text-amber ring-amber/30",
  rose: "bg-rose/10 text-rose ring-rose/30",
  fog: "bg-snow/5 text-fog ring-snow/15",
};

export function Pill({
  children,
  tone = "fog",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ring-1",
        toneClass[tone],
        className,
      )}
    >
      {dot && (
        <span className="animate-pulse-dot mr-1 inline-block size-1.5 rounded-full bg-current align-middle" />
      )}
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "delivered":
      return "cyan";
    case "paid":
      return "teal";
    case "pending":
      return "amber";
    case "failed":
    case "cancelled":
      return "rose";
    default:
      return "fog";
  }
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel-frost rounded-2xl p-5", className)}>{children}</div>;
}

export function ProductMark({
  letter,
  accent = "cyan",
  size = "md",
}: {
  letter: string;
  accent?: string;
  size?: "sm" | "md";
}) {
  const tone: Tone = (["cyan", "teal", "amber", "rose"] as string[]).includes(accent)
    ? (accent as Tone)
    : "cyan";
  return (
    <span
      className={cn(
        "grid place-items-center rounded-lg font-mono ring-1",
        toneClass[tone],
        size === "md" ? "size-10 text-base" : "size-9 text-sm",
      )}
    >
      {letter}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="panel-solid rounded-lg p-3">
      <p className="label-mono">{label}</p>
      <p className="mt-1 text-lg font-semibold text-snow">{value}</p>
      {hint && <p className="mt-0.5 font-mono text-[10px] text-fog">{hint}</p>}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="label-mono mb-1.5">{children}</p>;
}

export function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-lg bg-panel/60 px-3 py-2 text-sm text-snow ring-1 ring-snow/10 outline-none placeholder:text-fog/60 focus:ring-cyan/40",
        className,
      )}
    />
  );
}

export function ActionButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-cyan text-ink ring-cyan/50 hover:bg-cyan/90",
    ghost: "bg-snow/5 text-snow ring-snow/15 hover:bg-snow/10",
    danger: "bg-rose/15 text-rose ring-rose/30 hover:bg-rose/25",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg px-3 py-2 font-mono text-xs font-medium ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        styles,
        className,
      )}
    >
      {children}
    </button>
  );
}
