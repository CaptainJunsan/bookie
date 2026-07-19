import { useState } from "react";
import { BookOpen } from "lucide-react";

interface BookCoverProps {
  src: string | null | undefined;
  isbn?: string | null;
  title?: string;
  className?: string;
  fallbackClassName?: string;
  iconSize?: number;
}

function isbnCoverUrl(isbn: string, size: "S" | "M" | "L" = "L") {
  return `https://covers.openlibrary.org/b/isbn/${isbn.replace(/[^0-9X]/gi, "")}-${size}.jpg`;
}

function googleThumbUrl(isbn: string) {
  return `https://books.google.com/books/content?vid=ISBN${isbn.replace(/[^0-9X]/gi, "")}&printsec=frontcover&img=1&zoom=1`;
}

export default function BookCover({ src, isbn, title, className = "", fallbackClassName = "", iconSize = 20 }: BookCoverProps) {
  const [attempt, setAttempt] = useState(0);

  const sources = [
    src,
    isbn ? isbnCoverUrl(isbn) : null,
    isbn ? googleThumbUrl(isbn) : null,
  ].filter(Boolean) as string[];

  const deduplicated = [...new Set(sources)];

  if (deduplicated.length === 0 || attempt >= deduplicated.length) {
    return (
      <div className={`flex items-center justify-center bg-secondary text-muted-foreground ${fallbackClassName || className}`}>
        <BookOpen size={iconSize} />
      </div>
    );
  }

  return (
    <img
      src={deduplicated[attempt]}
      alt={title ?? "Book cover"}
      className={className}
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}
