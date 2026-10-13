"use client";

import { useId, type ReactNode } from "react";

export function InterestField({ label, error, children }: { label: string; error?: string; children: (attributes: { "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode }) {
  const id = useId();
  return <label className="interest-field"><span>{label}</span>{children({ "aria-invalid": Boolean(error), "aria-describedby": error ? id : undefined })}{error && <small id={id} className="interest-form-error">{error}</small>}</label>;
}
