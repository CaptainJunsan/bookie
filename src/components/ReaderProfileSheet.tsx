import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { X, Share2, BookOpen, TrendingUp, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import type { FamilyMember, Book, ReadingProgress, Rating } from "../lib/types";
import { generateReaderShareCard, shareWithOS, APP_URL } from "../lib/shareCard";

// ─── Bookworm level system ────────────────────────────────────────────────────

function bookwormScore(stats: ReaderStats): number {
  return (
    stats.booksFinished * 10 +
    Math.floor(stats.totalPagesRead / 100) +
    stats.reviewsWritten * 5 +
    stats.booksReading * 3 +
    stats.booksWantToRead
  );
}

function getLevel(score: number): { title: string; emoji: string } {
  if (score >= 200) return { title: "Reading Legend", emoji: "⚡" };
  if (score >= 100) return { title: "Legendary Reader", emoji: "🌟" };
  if (score >= 60)  return { title: "Reading Champion", emoji: "🏆" };
  if (score >= 30)  return { title: "Bookworm", emoji: "📚" };
  if (score >= 10)  return { title: "Page Turner", emoji: "📖" };
  return               { title: "Bookworm Jr.", emoji: "🌱" };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReaderStats {
  booksFinished: number;
  booksReading: number;
  booksWantToRead: number;
  totalPagesRead: number;
  avgRating: number | null;
  reviewsWritten: number;
  finishedBooks: Array<{ book: Book; rating: Rating | null }>;
  readingBooks: Array<{ book: Book; progress: ReadingProgress }>;
}

interface Props {
  member: FamilyMember | null;
  isBestReader?: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReaderProfileSheet({ member, isBestReader = false, onClose }: Props) {
  const { member: currentMember } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<ReaderStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const isMe = member?.id === currentMember?.id;

  function goToBook(bookId: string) {
    onClose();
    navigate(`/books/${bookId}`);
  }

  useEffect(() => {
    if (!member) { setStats(null); return; }
    loadStats(member.id);
  }, [member?.id]);

  async function loadStats(memberId: string) {
    setLoading(true);
    setStats(null);
    try {
      const [progressRes, ratingsRes] = await Promise.all([
        supabase
          .from("reading_progress")
          .select("*, books(*)")
          .eq("member_id", memberId),
        supabase
          .from("ratings")
          .select("*")
          .eq("member_id", memberId),
      ]);

      const rows = (progressRes.data as Array<ReadingProgress & { books: Book }>) ?? [];
      const ratings = (ratingsRes.data as Rating[]) ?? [];

      const finished = rows.filter((r) => r.status === "finished");
      const reading  = rows.filter((r) => r.status === "reading");
      const want     = rows.filter((r) => r.status === "want_to_read");

      // Pages: page_count for finished books (fallback to current_page) + current_page while reading
      const totalPagesRead =
        finished.reduce((acc, r) => acc + (r.books?.page_count ?? r.current_page), 0) +
        reading.reduce((acc, r) => acc + r.current_page, 0);

      const rated = ratings.filter((r) => r.reader_rating !== null);
      const avgRating =
        rated.length > 0
          ? rated.reduce((acc, r) => acc + r.reader_rating!, 0) / rated.length
          : null;

      setStats({
        booksFinished: finished.length,
        booksReading: reading.length,
        booksWantToRead: want.length,
        totalPagesRead,
        avgRating,
        reviewsWritten: ratings.filter((r) => r.review).length,
        finishedBooks: finished.map((r) => ({
          book: r.books,
          rating: ratings.find((rt) => rt.book_id === r.book_id) ?? null,
        })),
        readingBooks: reading.map((r) => ({ book: r.books, progress: r })),
      });
    } catch {
      toast.error("Couldn't load reader stats");
    }
    setLoading(false);
  }

  async function handleShare() {
    if (!member || !stats) return;
    setSharing(true);
    try {
      const score = bookwormScore(stats);
      const level = getLevel(score);
      const recentCovers = stats.finishedBooks
        .slice(0, 4)
        .map((f) => f.book?.cover_url)
        .filter(Boolean) as string[];

      const blob = await generateReaderShareCard({
        nickname: member.nickname,
        avatarEmoji: member.avatar_emoji,
        role: member.role,
        color: member.color,
        isBestReader,
        booksFinished: stats.booksFinished,
        totalPagesRead: stats.totalPagesRead,
        booksReading: stats.booksReading,
        avgRating: stats.avgRating,
        reviewsWritten: stats.reviewsWritten,
        level: level.title,
        levelEmoji: level.emoji,
        score,
        recentCovers,
      });

      const text = [
        `${member.avatar_emoji} ${member.nickname} is a ${level.title} ${level.emoji}`,
        `${stats.booksFinished} book${stats.booksFinished !== 1 ? "s" : ""} finished · ${stats.totalPagesRead.toLocaleString()} pages read`,
        `Track your family's reading on Bookie: ${APP_URL}`,
      ].join("\n");

      await shareWithOS({
        blob,
        fileName: `${member.nickname.toLowerCase()}-reader-card.png`,
        title: `${member.nickname}'s Reading Profile`,
        text,
        url: APP_URL,
      });
    } catch {
      toast.error("Could not generate reader card");
    } finally {
      setSharing(false);
    }
  }

  const score = stats ? bookwormScore(stats) : 0;
  const level = getLevel(score);

  return (
    <Dialog.Root open={!!member} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl border-t border-border max-w-lg mx-auto max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
            <Dialog.Title className="font-display font-bold text-lg">
              {isMe ? "Your profile" : `${member?.nickname}'s profile`}
            </Dialog.Title>
            <Dialog.Close className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-5">
            {member && (
              <>
                {/* Avatar + name */}
                <div className="flex items-center gap-4 pt-1">
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center text-5xl flex-shrink-0"
                    style={{ backgroundColor: member.color + "22", border: `2.5px solid ${member.color}55` }}
                  >
                    {member.avatar_emoji}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold leading-tight">{member.nickname}</h2>
                    <p className="text-muted-foreground text-sm">{member.role}</p>
                    {isBestReader && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary text-primary-foreground">
                        <TrendingUp size={10} /> Star Reader 🏆
                      </span>
                    )}
                  </div>
                </div>

                {/* Loading */}
                {loading && (
                  <div className="flex justify-center py-10">
                    <Loader2 size={28} className="animate-spin text-primary" />
                  </div>
                )}

                {stats && (
                  <>
                    {/* Level badge */}
                    <div
                      className="rounded-2xl p-4 flex items-center gap-4"
                      style={{ backgroundColor: member.color + "14", border: `1.5px solid ${member.color}30` }}
                    >
                      <span className="text-4xl">{level.emoji}</span>
                      <div className="flex-1">
                        <p className="font-display font-bold text-lg" style={{ color: member.color }}>
                          {level.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Bookworm Score: <strong className="text-foreground">{score}</strong>
                        </p>
                      </div>
                      {/* Mini score bar showing progress to next level */}
                      <NextLevelBar score={score} color={member.color} />
                    </div>

                    {/* Stats row 1 */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { emoji: "✅", value: stats.booksFinished, label: "Finished" },
                        { emoji: "📄", value: stats.totalPagesRead.toLocaleString(), label: "Pages read" },
                        { emoji: "📖", value: stats.booksReading, label: "Reading now" },
                      ].map(({ emoji, value, label }) => (
                        <StatCard key={label} emoji={emoji} value={String(value)} label={label} />
                      ))}
                    </div>

                    {/* Stats row 2 */}
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { emoji: "🎯", value: stats.booksWantToRead, label: "Want to read" },
                        { emoji: "⭐", value: stats.avgRating ? stats.avgRating.toFixed(1) : "–", label: "Avg rating" },
                        { emoji: "✍️", value: stats.reviewsWritten, label: "Reviews" },
                      ].map(({ emoji, value, label }) => (
                        <StatCard key={label} emoji={emoji} value={String(value)} label={label} />
                      ))}
                    </div>

                    {/* Currently reading */}
                    {stats.readingBooks.length > 0 && (
                      <section>
                        <h3 className="font-display font-semibold text-sm mb-2.5 flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                          <BookOpen size={13} /> Reading now
                        </h3>
                        <div className="space-y-2">
                          {stats.readingBooks.map(({ book, progress }) => {
                            const pct = book?.page_count
                              ? Math.min(100, Math.round((progress.current_page / book.page_count) * 100))
                              : null;
                            return (
                              <button
                                key={book?.id}
                                onClick={() => book?.id && goToBook(book.id)}
                                className="w-full text-left flex items-center gap-3 bg-secondary rounded-xl p-3 hover:bg-muted active:scale-[0.98] transition-all"
                              >
                                <div className="w-9 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center text-lg">
                                  {book?.cover_url
                                    ? <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                                    : "📘"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-xs line-clamp-1">{book?.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    p.{progress.current_page}
                                    {book?.page_count ? ` / ${book.page_count}` : ""}
                                    {pct !== null ? ` · ${pct}%` : ""}
                                  </p>
                                  {pct !== null && (
                                    <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${pct}%`, backgroundColor: member.color }}
                                      />
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* Finished books grid */}
                    {stats.finishedBooks.length > 0 && (
                      <section>
                        <h3 className="font-display font-semibold text-sm mb-2.5 text-muted-foreground uppercase tracking-wide">
                          Books finished
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                          {stats.finishedBooks.slice(0, 10).map(({ book, rating }) => (
                            <button
                              key={book?.id}
                              onClick={() => book?.id && goToBook(book.id)}
                              className="flex flex-col gap-1 group"
                              title={book?.title}
                            >
                              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-secondary flex items-center justify-center text-xl group-hover:ring-2 group-hover:ring-primary/50 group-active:scale-95 transition-all">
                                {book?.cover_url
                                  ? <img src={book.cover_url} alt={book.title} className="w-full h-full object-cover" />
                                  : "📘"}
                              </div>
                              {rating?.reader_rating && (
                                <p className="text-[8px] text-center leading-none">
                                  {"⭐".repeat(rating.reader_rating)}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                        {stats.finishedBooks.length > 10 && (
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            +{stats.finishedBooks.length - 10} more
                          </p>
                        )}
                      </section>
                    )}

                    {/* Empty state */}
                    {stats.booksFinished === 0 && stats.booksReading === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-4xl mb-2">🌱</p>
                        <p className="text-sm font-medium">Just getting started!</p>
                        <p className="text-xs mt-1">Add some books to the library to begin the adventure.</p>
                      </div>
                    )}

                    {/* Share button */}
                    <button
                      onClick={handleShare}
                      disabled={sharing}
                      className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60 shadow-md shadow-primary/20"
                    >
                      {sharing
                        ? <><Loader2 size={15} className="animate-spin" /> Generating card…</>
                        : <><Share2 size={15} /> Share reader card</>
                      }
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatCard({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="bg-secondary border border-border rounded-2xl p-3 text-center">
      <span className="text-xl block mb-1">{emoji}</span>
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[10px] text-muted-foreground font-medium leading-tight">{label}</p>
    </div>
  );
}

// Shows how far to the next level threshold
function NextLevelBar({ score, color }: { score: number; color: string }) {
  const thresholds = [0, 10, 30, 60, 100, 200];
  const nextIdx = thresholds.findIndex((t) => t > score);
  if (nextIdx === -1) return null; // already at max
  const lo = thresholds[nextIdx - 1] ?? 0;
  const hi = thresholds[nextIdx];
  const pct = Math.min(100, Math.round(((score - lo) / (hi - lo)) * 100));
  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-[10px] text-muted-foreground">{hi - score} to next</p>
      <div className="w-16 h-2 rounded-full bg-black/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
