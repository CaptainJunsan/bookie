import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Camera, Search, ArrowLeft, Upload, Loader2, BookOpen, X } from "lucide-react";
import { supabase, fetchBookByIsbn } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";
import type { IScannerControls } from "@zxing/browser";

export default function AddBookPage() {
  const navigate = useNavigate();
  const { family, member } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [fetchingIsbn, setFetchingIsbn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);

  // Start ZXing once the video element is in the DOM
  useEffect(() => {
    if (!scannerActive) return;
    let cancelled = false;

    async function initZxing() {
      // Wait one frame for the video element to mount
      await new Promise((r) => requestAnimationFrame(r));
      if (cancelled || !videoRef.current) return;

      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment", width: { ideal: 1920 } } },
          videoRef.current,
          async (result, err) => {
            if (!result) return;
            const code = result.getText();
            controls.stop();
            setScannerActive(false);
            await handleBarcode(code);
          }
        );
        if (!cancelled) controlsRef.current = controls;
        else controls.stop();
      } catch {
        if (!cancelled) {
          toast.error("Camera access denied. Enter the ISBN manually.");
          setScannerActive(false);
        }
      }
    }

    initZxing();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scannerActive]);

  async function handleBarcode(code: string) {
    setIsbn(code);
    setFetchingIsbn(true);
    const data = await fetchBookByIsbn(code);
    if (data) {
      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.page_count) setPageCount(String(data.page_count));
      if (data.cover_url) { setCoverUrl(data.cover_url); setCoverPreview(data.cover_url); }
      toast.success("Book found!");
    } else {
      toast.error("Book not found — please fill in the details manually.");
    }
    setFetchingIsbn(false);
  }

  async function fetchByIsbn() {
    if (!isbn.trim()) return;
    setFetchingIsbn(true);
    const data = await fetchBookByIsbn(isbn.trim());
    if (data) {
      if (data.title) setTitle(data.title);
      if (data.author) setAuthor(data.author);
      if (data.page_count) setPageCount(String(data.page_count));
      if (data.cover_url) { setCoverUrl(data.cover_url); setCoverPreview(data.cover_url); }
      toast.success("Book details found!");
    } else {
      toast.error("Book not found. Please enter details manually.");
    }
    setFetchingIsbn(false);
  }

  function stopScanner() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScannerActive(false);
  }

  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUrl("");
  }

  function clearCover() {
    setCoverUrl("");
    setCoverPreview("");
    setCoverFile(null);
  }

  async function save() {
    if (!title.trim()) { toast.error("Please enter a book title"); return; }
    if (!family || !member) return;
    setSaving(true);
    try {
      let finalCoverUrl = coverUrl;
      let coverStoragePath: string | null = null;

      if (coverFile) {
        // User-selected local file
        const ext = coverFile.name.split(".").pop();
        const path = `${family.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("book-covers").upload(path, coverFile);
        if (!uploadErr) {
          coverStoragePath = path;
          const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
          finalCoverUrl = data.publicUrl;
        }
      } else if (coverUrl) {
        // Remote cover fetched from Open Library / Google Books — download and re-upload
        // so it's served from our own storage and doesn't depend on external URLs staying live.
        try {
          const imgRes = await fetch(coverUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const path = `${family.id}/${Date.now()}.${ext}`;
            const { error: uploadErr } = await supabase.storage.from("book-covers").upload(path, blob, { contentType: blob.type });
            if (!uploadErr) {
              coverStoragePath = path;
              const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
              finalCoverUrl = data.publicUrl;
            }
          }
        } catch { /* keep remote URL if download fails */ }
      }

      const { data: book, error } = await supabase
        .from("books")
        .insert({
          family_id: family.id,
          title: title.trim(),
          author: author.trim() || null,
          isbn: isbn.trim() || null,
          cover_url: finalCoverUrl || null,
          cover_storage_path: coverStoragePath,
          page_count: pageCount ? parseInt(pageCount) : null,
          added_by: member.id,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success("Book added!");
      navigate(`/books/${book.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add book");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl lg:max-w-3xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold">Add a book</h1>
      </div>

      {/* ISBN + Scanner */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Search size={15} /> Find by ISBN</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchByIsbn()}
            placeholder="Enter or scan ISBN"
            inputMode="numeric"
            className="flex-1 px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <button
            onClick={fetchByIsbn}
            disabled={fetchingIsbn || !isbn.trim()}
            className="px-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
          >
            {fetchingIsbn ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          </button>
          <button
            onClick={scannerActive ? stopScanner : () => setScannerActive(true)}
            className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
              scannerActive
                ? "bg-destructive text-destructive-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-muted"
            }`}
            title={scannerActive ? "Close scanner" : "Scan barcode"}
          >
            {scannerActive ? <X size={16} /> : <Camera size={16} />}
          </button>
        </div>

        {scannerActive && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {/* Targeting guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-28">
                {/* Corner marks */}
                {[
                  "top-0 left-0 border-t-2 border-l-2 rounded-tl-md",
                  "top-0 right-0 border-t-2 border-r-2 rounded-tr-md",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md",
                  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-md",
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-6 h-6 border-primary ${cls}`} />
                ))}
                {/* Scan line animation */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary/70 animate-pulse" />
              </div>
            </div>
            <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80 font-medium">
              Point at the barcode on the back of the book
            </p>
          </div>
        )}

        {fetchingIsbn && (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Looking up book...
          </div>
        )}
      </div>

      {/* Book details */}
      <div className="space-y-4">
        <div className="flex gap-4">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="relative w-24 h-36">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center relative group cursor-pointer hover:opacity-90 transition-opacity"
              >
                {coverPreview ? (
                  <img
                    src={coverPreview}
                    alt="Cover"
                    className="w-full h-full object-cover"
                    onError={() => {
                      // Remote cover URL returned a bad/blank image — clear it so user can upload manually
                      setCoverPreview("");
                      setCoverUrl("");
                      toast.error("Cover image couldn't load — you can upload one manually.");
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground p-1">
                    <BookOpen size={22} />
                    <span className="text-[10px] font-medium text-center leading-tight">Tap to add cover</span>
                  </div>
                )}
                {coverPreview && (
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Upload size={18} />
                  </div>
                )}
              </div>
              {/* Clear button */}
              {coverPreview && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearCover(); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity z-10"
                  title="Remove cover"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {/* Camera/upload options below cover */}
            <div className="flex gap-1 mt-1.5 w-24">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] font-medium hover:text-foreground transition-colors flex items-center justify-center gap-0.5"
                title="Upload from library"
              >
                <Upload size={10} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute("capture");
                    fileInputRef.current.setAttribute("capture", "environment");
                    fileInputRef.current.click();
                  }
                }}
                className="flex-1 py-1 rounded-lg bg-muted text-muted-foreground text-[10px] font-medium hover:text-foreground transition-colors flex items-center justify-center gap-0.5"
                title="Take photo"
              >
                <Camera size={10} />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleCoverFile} className="hidden" />
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name"
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wide">Page count</label>
          <input
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            placeholder="e.g. 320"
            min="1"
            className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Used to show reading progress as a percentage.</p>
        </div>

        <button
          onClick={save}
          disabled={saving || !title.trim()}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-60 shadow-md shadow-primary/25 mt-2"
        >
          {saving ? "Adding book..." : "Add to library 📚"}
        </button>
      </div>
    </div>
  );
}
