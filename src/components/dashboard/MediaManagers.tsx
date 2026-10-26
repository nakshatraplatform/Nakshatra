"use client";

import { useState } from "react";
import { FileText, LockKeyhole, ExternalLink, Upload, Trash2, Images, Crown, ImagePlus } from "lucide-react";
import type { PortfolioHoroscope, PortfolioMedia, PortfolioMediaVisibility } from "@/types/portfolio";
import { MAX_PORTFOLIO_PHOTOS } from "@/features/media/portfolio-photo";
import { portfolioFieldAnchor } from "@/features/portfolio/editor-validation";
import { usePortfolioFieldError } from "@/components/portfolio/PortfolioFieldValidation";
import { PortfolioImage } from "@/components/loading/PortfolioImage";

export function HoroscopeManager({
  horoscope,
  uploading,
  inputRef,
  onUpload,
  onReview,
  onDelete,
}: {
  horoscope: PortfolioHoroscope | null;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (file: File | null, language: string) => void;
  onReview: () => void;
  onDelete: () => void;
}) {
  const [language, setLanguage] = useState(horoscope?.language_label || "");
  const format = horoscope?.file_extension === "pdf"
    ? "PDF document"
    : horoscope?.file_extension === "doc" || horoscope?.file_extension === "docx"
      ? "Word document"
      : "Scanned image";

  return (
    <section className="mb-8 border-b border-[var(--workspace-border)] pb-8">
      <div className="mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-ink)]">
          <FileText className="h-4 w-4 text-[var(--workspace-teal)]" />
          Horoscope attachment
        </h3>
        <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">
          One private scanned image. It appears only to signed-in people you choose to share with and opens separately from the introduction.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(event) => onUpload(event.target.files?.[0] || null, language)}
      />

      {horoscope ? (
        <article className="rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-teal-soft)] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] text-[var(--workspace-teal)]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-medium text-[var(--workspace-ink)]">Original horoscope</p>
                <p className="mt-2 text-xs text-[var(--workspace-ink-muted)]">
                  {[format, horoscope.language_label, formatBytes(horoscope.byte_size)].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-2 text-xs text-[var(--workspace-teal)]">
                  {horoscope.file_extension !== "webp"
                    ? "Legacy document — replace it with a scanned image before sharing"
                    : horoscope.published_at
                      ? "Published for people you’ve shared with"
                      : "Ready — publish or update the introduction to share it"}
                </p>
              </div>
            </div>
            <LockKeyhole className="h-4 w-4 shrink-0 text-[var(--workspace-ink-muted)]" aria-label="People you choose to share with" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={onReview} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--workspace-border)] px-4 text-xs font-medium text-[var(--workspace-ink)] hover:bg-[var(--workspace-surface-muted)]">
              <ExternalLink className="h-3.5 w-3.5" /> Review
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--workspace-border)] px-4 text-xs font-medium text-[var(--workspace-ink)] hover:bg-[var(--workspace-surface-muted)] disabled:opacity-50">
              <Upload className={`h-3.5 w-3.5 ${uploading ? "animate-pulse" : ""}`} /> Replace
            </button>
            <button type="button" onClick={onDelete} className="dashboard-danger-action focus-visible:ring-2 focus-visible:ring-[var(--workspace-teal)]">
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
        </article>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--workspace-border)] p-4">
          <label className="block text-xs font-medium text-[var(--workspace-ink-muted)]" htmlFor="horoscope-language">Horoscope language (optional)</label>
          <input
            id="horoscope-language"
            value={language}
            maxLength={80}
            onChange={(event) => setLanguage(event.target.value)}
            placeholder="For example, Kannada"
            className="mt-2 h-10 w-full rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] px-4 text-sm text-[var(--workspace-ink)] outline-none placeholder:text-[var(--workspace-ink-muted)] focus:border-[var(--workspace-border)]"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--workspace-teal-soft)] px-4 text-sm font-semibold text-[var(--workspace-ink)] hover:bg-[var(--ui-warning-surface)] disabled:opacity-50">
            <Upload className={`h-4 w-4 ${uploading ? "animate-pulse" : ""}`} />
            {uploading ? "Checking attachment..." : "Attach horoscope"}
          </button>
          <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">Scanned JPG, PNG, WebP, or HEIC · up to 20MB</p>
        </div>
      )}
    </section>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoManager({
  media,
  urls,
  uploading,
  inputRef,
  onUpload,
  onUpdate,
  onDelete,
}: {
  media: PortfolioMedia[];
  urls: Record<string, string>;
  uploading: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: (files: FileList | null) => void;
  onUpdate: (
    id: string,
    changes: Partial<Pick<PortfolioMedia, "visibility" | "media_type" | "alt_text">>
  ) => void;
  onDelete: (id: string) => void;
}) {
  const photoError = usePortfolioFieldError("media.primary_photo");
  const photoErrorId = photoError ? `${portfolioFieldAnchor("media.primary_photo")}-error` : undefined;
  const visibilityLabels: { value: PortfolioMediaVisibility; label: string }[] = [
    { value: "interest_required", label: "Blurred until shared" },
    { value: "public", label: "Visible to all" },
  ];

  return (
    <section className="mb-8 border-b border-[var(--workspace-border)] pb-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--workspace-ink)]">
            <Images className="h-4 w-4 text-[var(--workspace-teal)]" />
            Profile photos
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--workspace-ink-muted)]">
            Add up to eight photos. Your originals remain in the private photos bucket.
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-[var(--workspace-teal)]">{media.length}/{MAX_PORTFOLIO_PHOTOS}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(event) => onUpload(event.target.files)}
      />

      <div className="flex flex-wrap gap-4">
        {media.map((item) => (
          <article
            key={item.id}
            aria-label={item.media_type === "hero" ? "Primary photo" : "Profile photo"}
            className="w-36 shrink-0 overflow-hidden rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface-muted)] sm:w-40"
          >
            <div className="relative h-36 bg-[var(--workspace-surface-muted)] sm:h-40">
              {urls[item.id] ? (
                // Signed URLs are created client-side for the portfolio owner only.
                <PortfolioImage key={urls[item.id]} src={urls[item.id]} alt={item.alt_text || "Profile photo"} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-[var(--workspace-ink-muted)]">Preview unavailable</div>
              )}
              {item.media_type === "hero" && (
                <span className="absolute left-2 top-2 inline-flex items-center gap-2 rounded-md bg-[var(--workspace-teal-soft)] px-2 py-2 text-xs font-semibold text-[var(--workspace-ink)]">
                  <Crown className="h-3 w-3" /> Hero
                </span>
              )}
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="absolute right-2 top-2 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--workspace-border)] bg-[var(--workspace-surface)] text-[var(--ui-danger)] transition-[transform,box-shadow,filter] hover:bg-[var(--ui-danger-surface)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Delete photo"
                title="Delete photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2 p-2">
              <select
                value={visibilityLabels.some((option) => option.value === item.visibility) ? item.visibility : ""}
                onChange={(event) =>
                  onUpdate(item.id, { visibility: event.target.value as PortfolioMediaVisibility })
                }
                className="h-10 w-full rounded-md border border-[var(--workspace-border)] bg-[var(--workspace-surface)] px-2 text-xs text-[var(--workspace-ink)] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Photo visibility"
                data-portfolio-error-focus="visibility"
                aria-describedby={photoErrorId}
              >
                {!visibilityLabels.some((option) => option.value === item.visibility) && (
                  <option value="" disabled>Choose visibility</option>
                )}
                {visibilityLabels.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[var(--workspace-surface)]">
                    {option.label}
                  </option>
                ))}
              </select>
              {!visibilityLabels.some((option) => option.value === item.visibility) && (
                <p className="text-xs leading-4 text-[color:var(--workspace-ink-muted)]">
                  Choose how this photo should be shared. Its existing privacy remains unchanged until then.
                </p>
              )}
              {item.media_type !== "hero" && (
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { media_type: "hero" })}
                  data-portfolio-error-focus="primary"
                  aria-describedby={photoErrorId}
                  className="min-h-10 w-full rounded-md border border-[var(--workspace-border)] px-2 py-2 text-xs font-medium text-[var(--workspace-ink-muted)] transition-[transform,box-shadow,filter] hover:bg-[var(--workspace-surface-muted)]"
                >
                  Make primary photo
                </button>
              )}
            </div>
          </article>
        ))}
        {media.length < MAX_PORTFOLIO_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-describedby={photoErrorId}
            disabled={uploading}
            className="flex h-36 w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--workspace-border)] bg-[var(--workspace-teal-soft)] px-4 text-center text-xs font-medium text-[var(--workspace-teal)] transition-[transform,box-shadow,filter] hover:bg-[var(--workspace-teal-soft)] disabled:opacity-50 sm:h-40 sm:w-40"
          >
            {uploading ? <Upload className="h-5 w-5 animate-pulse" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? "Uploading" : "Add photos"}
          </button>
        )}
      </div>
    </section>
  );
}
