"use client";

import { useRef } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button, cn } from "@/components/ui";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImagePickerLabels {
  add: string;
  change: string;
  remove: string;
  hint: string;
}

interface Props {
  /** Object URL of a freshly picked file, or the stored download URL. */
  previewUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
  onError: (key: "notImage" | "imageTooBig") => void;
  labels: ImagePickerLabels;
  /** Thumbnail-sized variant used next to an answer option. */
  compact?: boolean;
}

/** Picks + previews one image. Uploading is the caller's job (it happens on save). */
export default function ImagePicker({ previewUrl, onPick, onClear, onError, labels, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!file) return;
    if (!file.type.startsWith("image/")) return onError("notImage");
    if (file.size > MAX_IMAGE_BYTES) return onError("imageTooBig");
    onPick(file);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />

      {previewUrl ? (
        <div className={cn("relative rounded-m3-lg border border-outline-variant bg-surface-container-lowest overflow-hidden", compact && "w-full")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className={cn("w-full object-contain bg-surface-container", compact ? "max-h-[110px]" : "max-h-[320px]")}
          />
          <div className="flex items-center justify-between gap-1 p-1.5 border-t border-outline-variant">
            <Button variant="text" size="sm" icon={<ImagePlus />} onClick={() => inputRef.current?.click()}>
              {compact ? "" : labels.change}
            </Button>
            <Button variant="text" size="sm" icon={<Trash2 />} onClick={onClear}>
              {compact ? "" : labels.remove}
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "m3-interactive w-full flex items-center justify-center gap-1.5 rounded-m3-lg border border-dashed border-outline text-on-surface-variant hover:text-primary hover:border-primary hover:bg-state-hover transition-colors",
            compact ? "py-2 text-[11px] font-bold" : "flex-col py-6",
          )}
        >
          <ImagePlus size={compact ? 15 : 22} />
          <span className={cn("font-bold", compact ? "text-[11px]" : "text-[13px]")}>{labels.add}</span>
          {!compact && <span className="text-[11px] font-medium text-outline">{labels.hint}</span>}
        </button>
      )}
    </>
  );
}
