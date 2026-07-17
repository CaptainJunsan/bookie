import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "../app/components/ui/utils";

interface StarRatingProps {
  value: number | null;
  onChange?: (val: number | null) => void;
  readonly?: boolean;
  size?: "sm" | "md" | "lg";
  label?: string;
}

export default function StarRating({ value, onChange, readonly = false, size = "md", label }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const sizeClass = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-7 h-7",
  }[size];

  function handleClick(star: number) {
    if (readonly || !onChange) return;
    onChange(value === star ? null : star);
  }

  const display = hovered ?? value ?? 0;

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>}
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => handleClick(star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "transition-transform",
              !readonly && "hover:scale-110 cursor-pointer",
              readonly && "cursor-default"
            )}
          >
            <Star
              className={cn(
                sizeClass,
                "transition-colors",
                star <= display
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-muted-foreground/40"
              )}
            />
          </button>
        ))}
        {value && !readonly && onChange && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
