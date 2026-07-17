import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Camera, Search, ArrowLeft, Upload, Loader2, BookOpen } from "lucide-react";
import { supabase, fetchOpenLibraryBook } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { toast } from "sonner";

export default function AddBookPage() {
  const navigate = useNavigate();
  const { family, member } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isbnInputRef = useRef<HTMLInputElement>(null);

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
  const streamRef = useRef<MediaStream | null>(null);

  async function fetchByIsbn() {
    if (!isbn.trim()) return;
    setFetchingIsbn(true);
    const data = await fetchOpenLibraryBook(isbn.trim());
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

  async function startScanner() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScannerActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);

      // @ts-ignore - BarcodeDetector is experimental
      if ("BarcodeDetector" in window) {
        // @ts-ignore
        const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "isbn"] });
        const interval = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              setIsbn(code);
              stopScanner();
              clearInterval(interval);
              // Auto-fetch
              setFetchingIsbn(true);
              const data = await fetchOpenLibraryBook(code);
              if (data) {
                if (data.title) setTitle(data.title);
                if (data.author) setAuthor(data.author);
                if (data.page_count) setPageCount(String(data.page_count));
                if (data.cover_url) { setCoverUrl(data.cover_url); setCoverPreview(data.cover_url); }
                toast.success("Book found from barcode!");
              }
              setFetchingIsbn(false);
            }
          } catch { /* continue */ }
        }, 500);
        setTimeout(() => clearInterval(interval), 30000);
      }
    } catch {
      toast.error("Camera access denied. Please enter the ISBN manually.");
    }
  }

  function stopScanner() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScannerActive(false);
  }

  function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUrl("");
  }

  async function save() {
    if (!title.trim()) { toast.error("Please enter a book title"); return; }
    if (!family || !member) return;
    setSaving(true);
    try {
      let finalCoverUrl = coverUrl;
      let coverStoragePath: string | null = null;

      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${family.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("book-covers").upload(path, coverFile);
        if (!uploadErr) {
          coverStoragePath = path;
          const { data } = supabase.storage.from("book-covers").getPublicUrl(path);
          finalCoverUrl = data.publicUrl;
        }
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
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl font-bold">Add a book</h1>
      </div>

      {/* ISBN Scanner */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-5">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Search size={15} /> Find by ISBN</h2>
        <div className="flex gap-2 mb-3">
          <input
            ref={isbnInputRef}
            type="text"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchByIsbn()}
            placeholder="Enter ISBN number"
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
            onClick={scannerActive ? stopScanner : startScanner}
            className={`px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${scannerActive ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}
          >
            <Camera size={16} />
          </button>
        </div>

        {scannerActive && (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video mb-2">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-48 h-24 border-2 border-primary rounded-lg opacity-70" />
            </div>
            <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/80">Point at the ISBN barcode</p>
          </div>
        )}
      </div>

      {/* Book details form */}
      <div className="space-y-4">
        <div className="flex gap-4">
          {/* Cover */}
          <div className="flex-shrink-0">
            <div className="w-24 h-32 rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center relative group">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <BookOpen size={28} className="text-muted-foreground" />
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
              >
                <Upload size={18} />
              </button>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="w-24 mt-1.5 text-[11px] text-center text-muted-foreground hover:text-primary transition-colors font-medium">
              Upload cover
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCoverFile} className="hidden" />
          </div>

          {/* Fields */}
          <div className="flex-1 space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Book title"
                className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted-foreground">Author</label>
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
          <label className="block text-xs font-semibold mb-1 text-muted-foreground">Page count</label>
          <input
            type="number"
            value={pageCount}
            onChange={(e) => setPageCount(e.target.value)}
            placeholder="e.g. 320"
            min="1"
            className="w-full px-3 py-2.5 rounded-xl bg-input-background border border-border outline-none focus:ring-2 focus:ring-ring text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">Helpful for tracking reading progress as a percentage.</p>
        </div>

        {coverUrl && !coverFile && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary rounded-xl px-3 py-2">
            <span>✅</span> Cover fetched from Open Library
          </div>
        )}

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
