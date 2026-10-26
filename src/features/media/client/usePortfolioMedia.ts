"use client";

import { useRef, useState } from "react";
import type { PortfolioHoroscope, PortfolioMedia } from "@/types/portfolio";
import type { PortfolioApiFailure } from "@/features/portfolio/client/portfolio-dashboard.api";
import { MAX_PORTFOLIO_PHOTOS } from "@/features/media/portfolio-photo";

/** The workspace reads the same media snapshot used by its publication review. */
export function usePortfolioMediaState({ initialMedia, initialMediaUrls, initialHoroscope }: {
  initialMedia: PortfolioMedia[]; initialMediaUrls: Record<string, string>; initialHoroscope: PortfolioHoroscope | null;
}) {
  const [mediaMutations, setMediaMutations] = useState(0);
  const [removingHoroscope, setRemovingHoroscope] = useState(false);
  const [portfolioMedia, setPortfolioMedia] = useState(initialMedia);
  const [mediaUrls, setMediaUrls] = useState(initialMediaUrls);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [portfolioHoroscope, setPortfolioHoroscope] = useState(initialHoroscope);
  const [uploadingHoroscope, setUploadingHoroscope] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const horoscopeInputRef = useRef<HTMLInputElement>(null);

  return { portfolioMedia, mediaUrls, portfolioHoroscope, mediaMutations, removingHoroscope, uploadingMedia, uploadingHoroscope, photoInputRef, horoscopeInputRef, setMediaMutations, setRemovingHoroscope, setPortfolioMedia, setMediaUrls, setUploadingMedia, setPortfolioHoroscope, setUploadingHoroscope };
}

/** Bind external operations after the workspace has established its revision and recovery callbacks. */
export function usePortfolioMediaActions({ state, activePortfolioId, setDraftError, handlePortfolioApiFailure, onPersistedChange, onRefresh }: {
  state: ReturnType<typeof usePortfolioMediaState>;
  activePortfolioId: string | null;
  setDraftError: (message: string | null) => void;
  handlePortfolioApiFailure: (failure: PortfolioApiFailure) => boolean;
  onPersistedChange: () => void;
  onRefresh: () => void;
}) {
  const { portfolioMedia, portfolioHoroscope, photoInputRef, horoscopeInputRef, setMediaMutations, setRemovingHoroscope, setPortfolioMedia, setMediaUrls, setUploadingMedia, setPortfolioHoroscope, setUploadingHoroscope } = state;
  async function uploadPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (!activePortfolioId) {
      setDraftError("Save your profile details before uploading photos.");
      return;
    }

    const availableSlots = Math.max(0, MAX_PORTFOLIO_PHOTOS - portfolioMedia.length);
    const selectedFiles = Array.from(files).slice(0, availableSlots);
    if (!selectedFiles.length) {
      setDraftError("Your gallery already has the maximum of eight photos.");
      return;
    }

    setUploadingMedia(true);
    setDraftError(null);
    try {
      const { uploadPortfolioPhotoRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("photo", file);
        formData.append("portfolioId", activePortfolioId);
        const result = await uploadPortfolioPhotoRequest(formData);
        if (!result.ok) return void handlePortfolioApiFailure(result);
        const { media, previewUrl } = result.data;
        setPortfolioMedia((current) => [...current, media]);
        if (previewUrl) {
          setMediaUrls((current) => ({ ...current, [media.id]: previewUrl }));
        }
        onPersistedChange();
        onRefresh();
      }
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Photo upload failed.");
    } finally {
      setUploadingMedia(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function updatePhoto(
    mediaId: string,
    changes: Partial<Pick<PortfolioMedia, "visibility" | "media_type" | "alt_text">>
  ) {
    setMediaMutations((count) => count + 1);
    setDraftError(null);
    try {
      const { updatePortfolioPhotoRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await updatePortfolioPhotoRequest(mediaId, changes);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioMedia((current) =>
        current.map((item) => {
          if (item.id === result.data.media.id) return result.data.media;
          if (changes.media_type === "hero" && item.media_type === "hero") {
            return { ...item, media_type: "gallery" };
          }
          return item;
        })
      );
      onPersistedChange();
    } catch {
      setDraftError("We could not update your photos. Please try again.");
    } finally {
      setMediaMutations((count) => count - 1);
    }
  }

  async function deletePhoto(mediaId: string) {
    if (!confirm("Permanently delete this photo? It will be removed from your portfolio and cannot be restored.")) return;
    setMediaMutations((count) => count + 1);
    setDraftError(null);
    try {
      const { deletePortfolioPhotoRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await deletePortfolioPhotoRequest(mediaId);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioMedia((current) => current.filter((item) => item.id !== mediaId));
      setMediaUrls((current) => Object.fromEntries(
        Object.entries(current).filter(([id]) => id !== mediaId)
      ));
      onPersistedChange();
    } catch {
      setDraftError("We could not update your photos. Please try again.");
    } finally {
      setMediaMutations((count) => count - 1);
    }
  }

  async function uploadHoroscopeFile(file: File | null, language: string) {
    if (!file) return;
    if (!activePortfolioId) {
      setDraftError("Save your profile details before attaching a horoscope.");
      return;
    }
    setUploadingHoroscope(true);
    setDraftError(null);
    try {
      const { uploadHoroscopeRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const formData = new FormData();
      formData.append("horoscope", file);
      formData.append("portfolioId", activePortfolioId);
      formData.append("language", language);
      const result = await uploadHoroscopeRequest(formData);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioHoroscope(result.data.horoscope);
      onPersistedChange();
      onRefresh();
    } catch {
      setDraftError("We could not upload the attachment. Please try again.");
    } finally {
      setUploadingHoroscope(false);
      if (horoscopeInputRef.current) horoscopeInputRef.current.value = "";
    }
  }

  function reviewHoroscope() {
    if (!portfolioHoroscope) return;
    window.open("/api/portfolio-horoscope/view", "_blank", "noopener,noreferrer");
  }

  async function removeHoroscope() {
    if (!portfolioHoroscope || !confirm("Remove this horoscope attachment? People you’ve shared with will lose access immediately.")) return;
    setRemovingHoroscope(true);
    setDraftError(null);
    try {
      const { deleteHoroscopeRequest } = await import(
        "@/features/portfolio/client/portfolio-dashboard.api"
      );
      const result = await deleteHoroscopeRequest(portfolioHoroscope.id);
      if (!result.ok) return void handlePortfolioApiFailure(result);
      setPortfolioHoroscope(null);
      onPersistedChange();
      onRefresh();
    } catch {
      setDraftError("We could not remove the attachment. Please try again.");
    } finally {
      setRemovingHoroscope(false);
    }
  }

  return { uploadPhotos, updatePhoto, deletePhoto, uploadHoroscopeFile, reviewHoroscope, removeHoroscope };
}
