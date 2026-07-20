interface StatCardProps {
  emoji?: string;
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
  compact?: boolean;
  onClick?: () => void;
}

/**
 * A single stat tile: icon/emoji + big value + label + optional sub-label.
 * Use this anywhere a number needs its own card instead of writing a new
 * one-off div (Dashboard stats row, Admin KPI grid, Settings summary, etc).
 */
export default function StatCard({
  emoji,
  icon,
  value,
  label,
  sub,
  compact = false,
  onClick,
}: StatCardProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={`bg-card border border-border rounded-2xl text-center transition-all w-full
        ${compact ? "p-3" : "p-4"}
        ${onClick ? "hover:border-primary/40 hover:shadow-sm active:scale-[0.98] cursor-pointer" : ""}`}
    >
      {(emoji || icon) && (
        <span className={`block mb-1 ${compact ? "text-xl" : "text-2xl"}`}>
          {icon ?? emoji}
        </span>
      )}
      <p className={`font-display font-bold ${compact ? "text-xl" : "text-2xl"}`}>{value}</p>
      <p className={`text-muted-foreground font-medium mt-0.5 ${compact ? "text-[10px]" : "text-[11px]"}`}>
        {label}
      </p>
      {sub && (
        <p className={`text-muted-foreground/70 ${compact ? "text-[9px]" : "text-[10px]"}`}>{sub}</p>
      )}
      {onClick && <span className="text-primary text-[10px] font-bold mt-1 block">View details →</span>}
    </Tag>
  );
}