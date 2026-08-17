"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { ProductMedia } from "@/types";
import { uploadMediaFile } from "@/lib/media/upload";

export function MediaUploader({
  folder,
  media,
  onChange,
}: {
  folder: string;
  media: ProductMedia[];
  onChange: (next: ProductMedia[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => uploadMediaFile(f, folder)));
      onChange([...media, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(media.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {media.map((m, i) => (
          <div key={m.publicId} className="relative h-20 w-20 overflow-hidden rounded-card bg-surface-muted">
            {m.isVideo ? (
              <video src={m.url} className="h-full w-full object-cover" muted />
            ) : (
              <Image src={m.url} alt={m.alt ?? ""} fill sizes="80px" className="object-cover" />
            )}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/60 px-1.5 text-xs text-white"
              aria-label="Remove media"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 items-center justify-center rounded-card border border-dashed border-ink-muted/40 text-xs text-ink-muted hover:border-brand"
        >
          {uploading ? "Uploading…" : "+ Add"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-ink-muted">
        Uploads go straight to Cloudinary via a server-signed request — the API secret never
        reaches this page.
      </p>
    </div>
  );
}
