"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, X, ImageIcon } from "lucide-react";

/**
 * Small drop-in file input that uploads to /api/upload (Cloudinary) and
 * returns the resulting URL via `onUploaded(url)`. Also supports pasting
 * a URL directly.
 *
 * Reusable from any admin form — product edit, banner edit, category icon.
 */
interface ImageUploaderProps {
  value?: string;
  onUploaded: (url: string) => void;
  folder?: string;
  label?: string;
  className?: string;
}

export default function ImageUploader({
  value,
  onUploaded,
  folder = "satyug_products",
  label = "Image",
  className,
}: ImageUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | undefined>(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/upload?folder=${encodeURIComponent(folder)}`,
        { method: "POST", credentials: "include", body: fd }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setPreview(data.url);
      onUploaded(data.url);
    } catch (err: any) {
      setError(err.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      {label && (
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </label>
      )}

      <div className="flex items-start gap-3">
        {/* Preview */}
        <div className="h-20 w-20 flex-shrink-0 rounded-xl border border-slate-800 bg-slate-950 overflow-hidden flex items-center justify-center">
          {preview ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* URL paste */}
          <input
            type="url"
            value={preview ?? ""}
            onChange={(e) => {
              setPreview(e.target.value);
              onUploaded(e.target.value);
            }}
            placeholder="https://…  (or upload below)"
            className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
          />

          {/* Upload button */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {busy ? "Uploading…" : "Upload"}
            </button>
            {preview && !busy && (
              <button
                type="button"
                onClick={() => {
                  setPreview(undefined);
                  onUploaded("");
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
          <p className="text-[10px] text-slate-500">
            JPG/PNG/WEBP · max 8 MB · uploads to Cloudinary
          </p>
        </div>
      </div>
    </div>
  );
}
