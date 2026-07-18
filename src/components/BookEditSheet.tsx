import { useState, useEffect, useRef } from "react";
import { X, Upload, Camera, Loader2, Search, BookOpen } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { supabase, fetchBookByIsbn } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import type { Book } from "../lib/types";

interface Props {
  book: Book | null;
  onClose: () => void;
  onSaved: (updated: Book) => void;
}

export default function BookEditSheet({ book, onClose, onSaved }: Props) {
  const { family } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [newRemoteCoverUrl, setNewRemoteCoverUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fetchingIsbn, setFetchingIsbn] = useState(false);

  // Sync fields whenever the sheet opens for a (different) book
  useEffect(() => {
    if (!book) return;
    setTitle(book.title ?? "");
    setAuthor(book.author ?? "");
    setIsbn(book.isbn ?? "");
    setPageCount(book.page_count ? String(book.page_count) : "");
    setCoverPreview(book.cover_url ?? "");
    setCoverFile(null);
    setNewRemoteCoverUrl(null);
  }, [book?.id]);

  async function refetchByIsbn() {
    if (!isbn.trim()) return;
    setFetchingIsbn(true);
    const data = await fetchBookByIsbn(isbn.trim());
    if (data) {
      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.page_count) setPageCount(String(data.page_count));
      if (data.cover_url) {
        setNewRemoteCoverUrl(data.cover_url);
        setCoverPreview(data.cover_url);
        setCoverFile(null);
      }
      toast.success("Book info updated from ISBN");
    } else {
      toast.error("No book found for this ISBN");
    }
    setFetchingIsbn(false);
  }

  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setNewRemoteCoverUrl(null);
    e.target.value = "";
  }

  function clearCover() {
    setCoverPreview("");
    setCoverFile(null);
    setNewRemoteCoverUrl(null);
  }

  async function save() {
    if (!book || !title.trim() || !family) return;
    setSaving(true);
    try {
      let finalCoverUrl: string | null = newRemoteCoverUrl ?? book.cover_url;
      let coverStoragePath: string | null = book.cover_storage_path;

      // User picked a new local file — upload it
      if (coverFile) {
        const ext = coverFile.name.split(".").pop() ?? "jpg";
        const path = `${family.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("book-covers").upload(path, coverFile);
        if (!error) {
          coverStoragePath = path;
          const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
          finalCoverUrl = data.publicUrl;
        }
      } else if (newRemoteCoverUrl && newRemoteCoverUrl !== book.cover_url) {
        // New remote URL from ISBN re-fetch — download and re-upload so it stays same-origin
        try {
          const res = await fetch(newRemoteCoverUrl);
          if (res.ok) {
            const blob = await res.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const path = `${family.id}/${Date.now()}.${ext}`;
            const { error } = await supabase.storage
              .from("book-covers")
              .upload(path, blob, { contentType: blob.type });
            if (!error) {
              coverStoragePath = path;
              const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
              finalCoverUrl = data.publicUrl;
            }
          }
        } catch { /* keep remote URL as-is */ }
      } else if (!coverPreview) {
        // User cleared the cover
        finalCoverUrl = null;
      }

      const { data: updated, error } = await supabase
        .from("books")
        .update({
          title: title.trim(),
          author: author.trim() || null,
          isbn: isbn.trim() || null,
          page_count: pageCount ? parseInt(pageCount) : null,
          cover_url: finalCoverUrl,
          cover_storage_path: coverStoragePath,
        })
        .eq("id", book.id)
        .select()
        .single();

      if (error) throw error;
      toast.success("Book updated!");
      onSaved(updated as Book);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={!!book} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl border-t border-border max-w-lg mx-auto max-h-[90vh] flex flex-col">

          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
            <Dialog.Title className="font-display font-bold text-lg">Edit book</Dialog.Title>
            <Dialog.Close className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={16} />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-4">
            {/* Cover + core fields */}
            <div className="flex gap-4">
              {/* Cover thumbnail */}
              <div className="flex-shrink-0">
                <div className="relative w-20 h-[116px]">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-full rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity group"
                  >
                    {coverPreview ? (
                      <img
                        src={coverPreview}
                        alt="Cover"
                        className="w-full h-full object-cover"
                        onError={() => clearCover()}
                      />
                    ) : (
                      <BookOpen size={20} className="text-muted-foreground" />
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-xl">
                      <Upload size={16} />
                    </div>
                  </div>
                  {coverPreview && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearCover(); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm z-10"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1 mt-1.5 w-20">
                  <button
                    type="button"
                    onClick={() => { fileInputRef.current?.removeAttribute("capture"); fileInputRef.current?.click(); }}
                    className="flex-1 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] flex items-center justify-center hover:text-foreground transition-colors"
                    title="Upload from library"
                  >
                    <Upload size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => { fileInputRef.current?.setAttribute("capture", "environment"); fileInputRef.current?.click(); }}
                    className="flex-1 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] flex items-center justify-center hover:text-foreground transition-colors"
                    title="Take photo"
                  >
                    <Camera size={10} />
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverFile} className="hidden" />
              </div>

              {/* Title + author */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Author</label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Page count */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Page count</label>
              <input
                type="number"
                value={pageCount}
                onChange={(e) => setPageCount(e.target.value)}
                min="1"
                placeholder="e.g. 320"
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>

            {/* ISBN re-fetch */}
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">ISBN</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && refetchByIsbn()}
                  placeholder="ISBN-13 or ISBN-10"
                  inputMode="numeric"
                  className="flex-1 px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <button
                  onClick={refetchByIsbn}
                  disabled={fetchingIsbn || !isbn.trim()}
                  className="px-3 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-semibold disabled:opacity-60 hover:bg-muted transition-colors flex items-center gap-1.5"
                >
                  {fetchingIsbn ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                  Re-fetch
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Re-fetching overwrites title, author, page count, and cover with data from Open Library.
                Useful for reprints with different page counts or cover art.
              </p>
            </div>

            <button
              onClick={save}
              disabled={saving || !title.trim()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
            >
              {saving
                ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                : "Save changes"
              }
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
