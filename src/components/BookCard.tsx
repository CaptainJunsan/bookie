import { useNavigate } from "react-router";
import { BookOpen } from "lucide-react";
import type { Book, ReadingProgress, Rating, FamilyMember } from "../lib/types";

interface BookCardProps {
  book: Book;
  progress?: ReadingProgress[];
  ratings?: Rating[];
  members?: FamilyMember[];
  compact?: boolean;
}

export default function BookCard({ book, progress = [], ratings = [], members = [], compact = false }: BookCardProps) {
  const navigate = useNavigate();

  const readingProgress  = progress.filter((p) => p.status === "reading");
  const finishedProgress = progress.filter((p) => p.status === "finished");

  // Avg reader rating across all members who rated this book
  const readerRatings = ratings.filter((r) => r.reader_rating !== null);
  const avgRating = readerRatings.length > 0
    ? readerRatings.reduce((acc, r) => acc + r.reader_rating!, 0) / readerRatings.length
    : null;

  const finishedCount = finishedProgress.length;
  const readingCount  = readingProgress.length;
  const reviewCount   = ratings.filter((r) => r.review).length;

  return (
    <button
      onClick={() => navigate(`/books/${book.id}`)}
      className="group w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 active:scale-[0.98]"
    >
      <div className="flex gap-0">
        {/* Cover */}
        <div
          className="w-20 flex-shrink-0 bg-secondary flex items-center justify-center overflow-hidden"
          style={{ minHeight: compact ? 96 : 120 }}
        >
          {book.cover_url ? (
            <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="flex flex-col items-center gap-1 p-2 text-muted-foreground">
              <BookOpen size={24} />
              <span className="text-[9px] text-center leading-tight font-medium">No cover</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0 gap-1.5">
          {/* Title + author */}
          <div>
            <h3 className="font-display font-bold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            {book.author && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>
            )}
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {book.page_count && (
              <Chip>📄 {book.page_count.toLocaleString()} pp</Chip>
            )}
            {finishedCount > 0 && (
              <Chip>✅ {finishedCount} read</Chip>
            )}
            {readingCount > 0 && (
              <div className="flex items-center gap-1">
                {readingProgress.slice(0, 4).map((p) => {
                  const m = members.find((mb) => mb.id === p.member_id);
                  return (
                    <span
                      key={p.member_id}
                      title={m?.nickname}
                      className="w-4 h-4 rounded-full text-[9px] flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: m?.color + "33", border: `1.5px solid ${m?.color}` }}
                    >
                      {m?.avatar_emoji}
                    </span>
                  );
                })}
                <span className="text-[10px] text-muted-foreground font-medium">reading</span>
              </div>
            )}
          </div>

          {/* Rating */}
          {avgRating !== null ? (
            <div className="flex items-center gap-1">
              <span className="text-amber-400 text-xs">{"★".repeat(Math.round(avgRating))}</span>
              <span className="text-xs font-bold text-foreground">{avgRating.toFixed(1)}</span>
              <span className="text-[10px] text-muted-foreground">
                ({reviewCount > 0 ? `${reviewCount} review${reviewCount !== 1 ? "s" : ""}` : `${readerRatings.length} rating${readerRatings.length !== 1 ? "s" : ""}`})
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/60 italic">No reviews yet</p>
          )}
        </div>
      </div>
    </button>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold text-muted-foreground leading-none">
      {children}
    </span>
  );
}
