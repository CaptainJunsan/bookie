import { useState } from "react";
import { Share2, MessageCircle, Copy, X, Check, Loader2 } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { toast } from "sonner";
import type { Book, Rating } from "../lib/types";
import {
  APP_URL,
  generateBookShareCard,
  shareWithOS,
  whatsappBookMessage,
} from "../lib/shareCard";

interface ShareSheetProps {
  book: Book;
  rating?: Rating | null;
  familyName?: string;
}

export default function ShareSheet({ book, rating, familyName }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const bookUrl = `${APP_URL}/books/${book.id}`;

  const bookData = {
    title: book.title,
    author: book.author,
    cover_url: book.cover_url,
    readerRating: rating?.reader_rating ?? null,
    review: rating?.review ?? null,
    familyName,
  };

  const waMessage = whatsappBookMessage(bookData, bookUrl);
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

  async function handleShare() {
    setSharing(true);
    try {
      const blob = await generateBookShareCard(bookData);
      const result = await shareWithOS({
        blob,
        fileName: `${book.title.replace(/\s+/g, "-")}.png`,
        title: book.title,
        text: waMessage,
        url: bookUrl,
      });
      if (result === "fallback") {
        // Web Share not supported — copy text as fallback
        await navigator.clipboard.writeText(`${waMessage}\n\n${bookUrl}`);
        toast.success("Message copied to clipboard!");
      }
    } catch {
      toast.error("Could not generate share card");
    } finally {
      setSharing(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(bookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stars = rating?.reader_rating ? "⭐".repeat(rating.reader_rating) : "";

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold hover:bg-muted transition-colors">
          <Share2 size={15} />
          Share
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6 shadow-2xl border-t border-border max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-display font-bold text-lg">Share this book</Dialog.Title>
            <Dialog.Close className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Book preview */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-secondary rounded-xl">
            {book.cover_url ? (
              <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-10 h-14 rounded-lg bg-muted flex items-center justify-center text-xl flex-shrink-0">📚</div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{book.title}</p>
              {book.author && <p className="text-xs text-muted-foreground truncate">{book.author}</p>}
              {stars && <p className="text-sm mt-0.5">{stars}</p>}
            </div>
          </div>

          {/* Share actions */}
          <div className="grid grid-cols-3 gap-3">
            {/* Native OS share — generates bespoke card image */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-90 transition-opacity disabled:opacity-60 col-span-1"
            >
              {sharing
                ? <Loader2 size={20} className="animate-spin" />
                : <Share2 size={20} />
              }
              {sharing ? "Generating…" : "Share"}
            </button>

            {/* WhatsApp */}
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-[#25D366] text-white font-semibold text-xs hover:opacity-90 transition-opacity"
            >
              <MessageCircle size={20} />
              WhatsApp
            </a>

            {/* Copy link */}
            <button
              onClick={copyLink}
              className="flex flex-col items-center gap-1.5 py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-xs hover:bg-muted transition-colors"
            >
              {copied ? <Check size={20} className="text-primary" /> : <Copy size={20} />}
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-3">
            "Share" creates a branded card image for iMessage, AirDrop, and more.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
