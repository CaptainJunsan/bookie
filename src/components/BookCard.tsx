import { useNavigate } from "react-router";
import { BookOpen, Star } from "lucide-react";
import type { Book, ReadingProgress, Rating, FamilyMember } from "../lib/types";

interface BookCardProps {
  book: Book;
  progress?: ReadingProgress[];
  rating?: Rating | null;
  members?: FamilyMember[];
  compact?: boolean;
}

export default function BookCard({ book, progress = [], rating, members = [], compact = false }: BookCardProps) {
  const navigate = useNavigate();

  const avgReaderRating = rating?.reader_rating ?? null;
  const readingMembers = progress.filter((p) => p.status === "reading");
  const finishedMembers = progress.filter((p) => p.status === "finished");

  return (
    <button
      onClick={() => navigate(`/books/${book.id}`)}
      className="group w-full text-left bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md hover:border-primary/30 transition-all duration-200 active:scale-[0.98]"
    >
      <div className="flex gap-0">
        {/* Cover */}
        <div className="w-20 flex-shrink-0 bg-secondary flex items-center justify-center overflow-hidden" style={{ minHeight: compact ? 96 : 120 }}>
          {book.cover_url ? (
            <img
              src={book.cover_url}
              alt={book.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 p-2 text-muted-foreground">
              <BookOpen size={24} />
              <span className="text-[9px] text-center leading-tight font-medium">No cover</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
          <div>
            <h3 className="font-display font-bold text-sm leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            {book.author && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1">
              {/* Bookmark dots: reading members */}
              {readingMembers.slice(0, 4).map((p) => {
                const m = members.find((mb) => mb.id === p.member_id);
                return (
                  <span
                    key={p.member_id}
                    title={m?.nickname}
                    className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center"
                    style={{ backgroundColor: m?.color + "33", border: `2px solid ${m?.color}` }}
                  >
                    {m?.avatar_emoji}
                  </span>
                );
              })}
              {finishedMembers.length > 0 && (
                <span className="text-[10px] text-primary font-semibold ml-1">
                  ✓{finishedMembers.length}
                </span>
              )}
            </div>

            {avgReaderRating && (
              <div className="flex items-center gap-0.5">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span className="text-xs font-bold text-foreground">{avgReaderRating}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
