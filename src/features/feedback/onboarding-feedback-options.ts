export const hardestStepValues = ["none", "details", "photos", "verification", "publishing", "other"] as const;
export const hardestStepLabels: Record<(typeof hardestStepValues)[number], string> = {
  none: "Nothing stood out",
  details: "Writing my details",
  photos: "Adding photos",
  verification: "Liveness checks",
  publishing: "Understanding publishing",
  other: "Something else",
};

export const likedAspectValues = ["guidance", "photos", "preview", "design", "privacy", "other"] as const;
export const likedAspectLabels: Record<(typeof likedAspectValues)[number], string> = {
  guidance: "Clear guidance",
  photos: "How my photos looked",
  preview: "Previewing my portfolio",
  design: "Portfolio design",
  privacy: "Privacy controls",
  other: "Something else",
};
