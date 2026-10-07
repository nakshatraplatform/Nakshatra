"use client";

import { ChevronLeft, ChevronRight, LockKeyhole, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  classifyPhotoOrientation,
  type PortfolioPhoto,
} from "@/features/media/portfolio-photo";
import type { PortfolioPhotoOrientation } from "@/types/portfolio";

/**
 * Renders public portfolio photos without changing their intrinsic proportions.
 * Input: ordered signed photo URLs. Output: an adaptive hero slideshow or a themed fallback.
 */
export function AdaptivePortfolioHero({
  photos,
  fallbackColor = "#17151c",
}: {
  photos: PortfolioPhoto[];
  fallbackColor?: string;
}) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [detectedOrientations, setDetectedOrientations] = useState<
    Record<string, PortfolioPhotoOrientation>
  >({});
  const activeIndex = photos.length ? activeSlide % photos.length : 0;
  const activePhoto = photos[activeIndex];
  const activeOrientation = activePhoto
    ? activePhoto.orientation === "unknown"
      ? detectedOrientations[activePhoto.id] || "unknown"
      : activePhoto.orientation
    : "unknown";

  /**
   * Moves the slideshow in either direction and wraps at both ends.
   * Input: previous or next direction. Output: updates the active image index.
   */
  function moveSlide(direction: -1 | 1) {
    setActiveSlide(
      (current) => (current + direction + photos.length) % photos.length
    );
  }

  /**
   * Supplies orientation for legacy media rows that predate persisted dimensions.
   * Input: loaded browser image dimensions. Output: caches orientation for the active photo.
   */
  function detectLegacyOrientation(
    photoId: string,
    width: number,
    height: number
  ) {
    setDetectedOrientations((current) => ({
      ...current,
      [photoId]: classifyPhotoOrientation(width, height),
    }));
  }

  if (!activePhoto) {
    return (
      <div
        className="portfolio-hero-empty"
        style={{ backgroundColor: fallbackColor }}
        aria-label="Portfolio photo has not been added"
      />
    );
  }

  return (
    <div
      className="portfolio-hero-media"
      data-orientation={activeOrientation}
      data-presentation={activePhoto.presentation || "clear"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activePhoto.src}
        alt={activePhoto.alt}
        width={activePhoto.width}
        height={activePhoto.height}
        className="portfolio-hero-photo"
        onLoad={(event) => {
          if (activePhoto.orientation === "unknown") {
            detectLegacyOrientation(
              activePhoto.id,
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight
            );
          }
        }}
      />

      {activePhoto.presentation === "blurred" && <ProtectedPhotoLabel />}

      {photos.length > 1 && (
        <div className="portfolio-hero-controls">
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="Show previous photo"
            title="Previous photo"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <span aria-live="polite">
            {activeIndex + 1} / {photos.length}
          </span>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="Show next photo"
            title="Next photo"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Displays gallery photos in an accessible viewer while preserving every original ratio.
 * Input: public gallery photos. Output: a responsive featured view, thumbnails, and lightbox.
 */
export function AdaptivePortfolioGallery({
  photos,
}: {
  photos: PortfolioPhoto[];
}) {
  const [detectedOrientations, setDetectedOrientations] = useState<
    Record<string, PortfolioPhotoOrientation>
  >({});
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const lightboxTriggerRef = useRef<HTMLButtonElement | null>(null);
  const lightboxCloseRef = useRef<HTMLButtonElement | null>(null);
  const orderedPhotos = useMemo(
    () => photos
      .map((photo, index) => ({ photo, index }))
      .sort((left, right) => {
        const visibilityDifference = Number(left.photo.presentation === "blurred")
          - Number(right.photo.presentation === "blurred");
        return visibilityDifference || left.index - right.index;
      })
      .map(({ photo }) => photo),
    [photos]
  );
  const activeIndex = Math.min(activePhotoIndex, Math.max(orderedPhotos.length - 1, 0));
  const activePhoto = orderedPhotos[activeIndex];
  const clearPhotos = useMemo(
    () => orderedPhotos.filter((photo) => photo.presentation !== "blurred"),
    [orderedPhotos]
  );
  const lightboxIndex = clearPhotos.findIndex((photo) => photo.id === lightboxPhotoId);
  const lightboxPhoto = lightboxIndex >= 0 ? clearPhotos[lightboxIndex] : null;
  const lightboxOpen = Boolean(lightboxPhoto);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    lightboxCloseRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      lightboxTriggerRef.current?.focus();
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxPhotoId(null);
      } else if (event.key === "Tab") {
        const controls = Array.from(document.querySelectorAll<HTMLElement>(
          ".portfolio-lightbox button:not([disabled])"
        ));
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!document.activeElement?.closest(".portfolio-lightbox")) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === "ArrowLeft" && clearPhotos.length > 1) {
        const previous = (lightboxIndex - 1 + clearPhotos.length) % clearPhotos.length;
        setLightboxPhotoId(clearPhotos[previous].id);
      } else if (event.key === "ArrowRight" && clearPhotos.length > 1) {
        const next = (lightboxIndex + 1) % clearPhotos.length;
        setLightboxPhotoId(clearPhotos[next].id);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearPhotos, lightboxIndex, lightboxOpen]);

  if (!photos.length) return null;

  function moveGallery(direction: -1 | 1) {
    setActivePhotoIndex(
      (current) => (current + direction + orderedPhotos.length) % orderedPhotos.length
    );
  }

  function moveLightbox(direction: -1 | 1) {
    if (lightboxIndex < 0 || clearPhotos.length < 2) return;
    const next = (lightboxIndex + direction + clearPhotos.length) % clearPhotos.length;
    setLightboxPhotoId(clearPhotos[next].id);
  }

  function handleSwipe(endX: number) {
    if (touchStartX === null) return;
    const distance = endX - touchStartX;
    if (Math.abs(distance) >= 45 && orderedPhotos.length > 1) {
      moveGallery(distance > 0 ? -1 : 1);
    }
    setTouchStartX(null);
  }

  /**
   * Resolves legacy media orientation from natural browser dimensions.
   * Input: photo ID and loaded image dimensions. Output: updates that gallery item's span.
   */
  function detectLegacyOrientation(
    photoId: string,
    width: number,
    height: number
  ) {
    setDetectedOrientations((current) => ({
      ...current,
      [photoId]: classifyPhotoOrientation(width, height),
    }));
  }

  return (
    <section className="portfolio-gallery" aria-labelledby="portfolio-gallery-title">
      <div className="portfolio-section-heading">
        <p>Captured moments</p>
        <h2 id="portfolio-gallery-title">Gallery</h2>
      </div>
      <div className="portfolio-gallery-meta">
        <p>A simple collection of everyday moments.</p>
        <span>{orderedPhotos.length} photo{orderedPhotos.length === 1 ? "" : "s"}</span>
      </div>
      <div className="portfolio-gallery-viewer">
        <div className="portfolio-gallery-feature-column">
          <figure
            className="portfolio-gallery-feature"
            data-presentation={activePhoto.presentation || "clear"}
            onTouchStart={(event) => setTouchStartX(event.changedTouches[0].clientX)}
            onTouchEnd={(event) => handleSwipe(event.changedTouches[0].clientX)}
          >
            {activePhoto.presentation === "blurred" ? (
              <ProtectedGalleryTile />
            ) : (
              <button
                type="button"
                className="portfolio-gallery-open"
                onClick={(event) => {
                  lightboxTriggerRef.current = event.currentTarget;
                  setLightboxPhotoId(activePhoto.id);
                }}
                aria-label={`Open ${activePhoto.alt || "gallery photo"} full screen`}
              >
                <GalleryImage
                  photo={activePhoto}
                  loading="lazy"
                  detectedOrientation={detectedOrientations[activePhoto.id]}
                  onDetect={detectLegacyOrientation}
                />
              </button>
            )}
            {activePhoto.presentation !== "blurred" && meaningfulCaption(activePhoto.alt) && (
              <figcaption>{activePhoto.alt}</figcaption>
            )}
          </figure>

          <div className="portfolio-gallery-controls" aria-label="Gallery controls">
            <button type="button" onClick={() => moveGallery(-1)} disabled={orderedPhotos.length < 2} aria-label="Show previous gallery photo">
              <ChevronLeft aria-hidden="true" />
            </button>
            <span aria-live="polite">{activeIndex + 1} of {orderedPhotos.length}</span>
            <button type="button" onClick={() => moveGallery(1)} disabled={orderedPhotos.length < 2} aria-label="Show next gallery photo">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="portfolio-gallery-thumbnails" role="group" aria-label="Choose a gallery photo">
          {orderedPhotos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className="portfolio-gallery-thumbnail"
              data-active={index === activeIndex}
              data-presentation={photo.presentation || "clear"}
              onClick={() => setActivePhotoIndex(index)}
              aria-label={photo.presentation === "blurred" ? `Photo ${index + 1}, shared after approval` : `Show photo ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              {photo.presentation === "blurred" ? (
                <span className="portfolio-gallery-thumbnail-lock"><LockKeyhole aria-hidden="true" /></span>
              ) : (
                <GalleryImage
                  photo={photo}
                  loading="lazy"
                  decorative
                  detectedOrientation={detectedOrientations[photo.id]}
                  onDetect={detectLegacyOrientation}
                />
              )}
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      </div>

      {lightboxPhoto && createPortal(
        <div data-template="celestial-union" className="portfolio-lightbox-portal">
        <div className="portfolio-lightbox" role="dialog" aria-modal="true" aria-label="Gallery photo viewer" onClick={(event) => {
          const target = event.target;
          if (target instanceof Element && !target.closest("button, img, figcaption")) setLightboxPhotoId(null);
        }}>
          <button ref={lightboxCloseRef} type="button" className="portfolio-lightbox-close" onClick={() => setLightboxPhotoId(null)} aria-label="Close photo and return to gallery">
            <X aria-hidden="true" />
          </button>
          {clearPhotos.length > 1 && (
            <button type="button" className="portfolio-lightbox-previous" onClick={() => moveLightbox(-1)} aria-label="Show previous available photo">
              <ChevronLeft aria-hidden="true" />
            </button>
          )}
          <figure>
            <GalleryImage photo={lightboxPhoto} loading="eager" onDetect={detectLegacyOrientation} />
            <figcaption>
              <span>{lightboxIndex + 1} of {clearPhotos.length}</span>
              {meaningfulCaption(lightboxPhoto.alt) && <strong>{lightboxPhoto.alt}</strong>}
            </figcaption>
          </figure>
          {clearPhotos.length > 1 && (
            <button type="button" className="portfolio-lightbox-next" onClick={() => moveLightbox(1)} aria-label="Show next available photo">
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </div>
        </div>,
        document.body
      )}
    </section>
  );
}

function GalleryImage({
  photo,
  loading,
  detectedOrientation,
  onDetect,
  decorative = false,
}: {
  photo: PortfolioPhoto;
  loading: "eager" | "lazy";
  detectedOrientation?: PortfolioPhotoOrientation;
  onDetect: (photoId: string, width: number, height: number) => void;
  decorative?: boolean;
}) {
  const orientation = photo.orientation === "unknown"
    ? detectedOrientation || "unknown"
    : photo.orientation;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.src}
      alt={decorative ? "" : photo.alt}
      width={photo.width}
      height={photo.height}
      loading={loading}
      data-orientation={orientation}
      onLoad={(event) => {
        if (photo.orientation === "unknown") {
          onDetect(photo.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
        }
      }}
    />
  );
}

function meaningfulCaption(alt: string) {
  const normalized = alt.trim().toLowerCase();
  return normalized !== "" && normalized !== "portfolio photo" && normalized !== "gallery photo";
}

function ProtectedGalleryTile() {
  return (
    <div className="portfolio-gallery-protected">
      <span><LockKeyhole aria-hidden="true" /></span>
      <strong>Photo shared after approval</strong>
      <p>This photo stays protected until the portfolio owner approves access.</p>
    </div>
  );
}

function ProtectedPhotoLabel() {
  return (
    <span className="portfolio-protected-photo-label">
      <LockKeyhole aria-hidden="true" />
      <span>Photo shared after approval</span>
    </span>
  );
}
