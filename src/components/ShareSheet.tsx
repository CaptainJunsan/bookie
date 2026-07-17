import { useState } from "react";
import { Share2, MessageCircle, Copy, X, Check } from "lucide-react";
import type { Book, Rating } from "../lib/types";
import * as Dialog from "@radix-ui/react-dialog";

interface ShareSheetProps {
  book: Book;
  rating?: Rating | null;
}

export default function ShareSheet({ book, rating }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const stars = rating?.reader_rating ? "⭐".repeat(rating.reader_rating) : "";
  const message = [
    `📚 *${book.title}*${book.author ? ` by ${book.author}` : ""}`,
    stars ? `Reader rating: ${stars}` : "",
    rating?.review ? `"${rating.review}"` : "",
    "",
    "We track our family's reading adventures on Bookie! 🎉",
    "Join us: https://bookie.app",
  ].filter(Boolean).join("\n");

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copyText() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

          {book.cover_url && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-secondary rounded-xl">
              <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded-lg" />
              <div>
                <p className="font-bold text-sm">{book.title}</p>
                {book.author && <p className="text-xs text-muted-foreground">{book.author}</p>}
                {stars && <p className="text-sm mt-1">{stars}</p>}
              </div>
            </div>
          )}

          <div className="bg-muted rounded-xl p-3 mb-4">
            <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{message}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:opacity-90 transition-opacity"
            >
              <MessageCircle size={18} />
              WhatsApp
            </a>
            <button
              onClick={copyText}
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm hover:bg-muted transition-colors"
            >
              {copied ? <Check size={18} className="text-primary" /> : <Copy size={18} />}
              {copied ? "Copied!" : "Copy text"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
