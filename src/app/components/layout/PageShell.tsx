import type { ReactNode } from "react";

interface PageShellProps {
  title?: string;
  headerAction?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Standard page layout: single column on mobile/tablet, main + sticky aside
 * grid on desktop. Use this instead of hand-rolling `lg:grid-cols-[...]`
 * per page so every page's desktop behavior stays consistent.
 *
 * If `aside` is omitted, content simply stays single-column at every width.
 */
export default function PageShell({
  title,
  headerAction,
  aside,
  children,
  className = "",
}: PageShellProps) {
  return (
    <div className={`max-w-2xl lg:max-w-none mx-auto lg:mx-0 px-4 lg:px-10 py-6 pb-24 lg:pb-10 ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between mb-5">
          {title && <h1 className="font-display text-2xl font-bold">{title}</h1>}
          {headerAction}
        </div>
      )}

      {aside ? (
        <div className="lg:grid lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] lg:gap-8 lg:items-start space-y-8 lg:space-y-0">
          <div className="space-y-6">{children}</div>
          <aside className="hidden lg:block space-y-6 lg:sticky lg:top-6">
            {aside}
          </aside>
        </div>
      ) : (
        <div className="space-y-6">{children}</div>
      )}
    </div>
  );
}