"use client";

import { useState } from "react";

/** The renderer supplies these values only after its existing access projection. */
export function PortfolioContactActions({ phone, email }: { phone?: string; email?: string }) {
  const [notice, setNotice] = useState("");
  const dialNumber = phone?.replace(/[\s().-]/g, "");
  const phoneHref = dialNumber && /^\+?\d{7,15}$/.test(dialNumber) ? `tel:${dialNumber}` : undefined;
  const emailHref = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${encodeURIComponent(email)}` : undefined;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch { setNotice(`Could not copy ${label.toLowerCase()}. Select the value to copy it manually.`); }
  }

  return <div className="portfolio-contact-actions">
    {phone && <div className="portfolio-contact-value">
      <p>{phone}</p><div className="portfolio-contact-buttons">
        {phoneHref && <a className="portfolio-text-action" href={phoneHref}>Call</a>}
        <button type="button" className="portfolio-text-action" onClick={() => void copy(phone, "Phone number")}>Copy phone</button>
      </div>
    </div>}
    {email && <div className="portfolio-contact-value">
      <p>{email}</p><div className="portfolio-contact-buttons">
        {emailHref && <a className="portfolio-text-action" href={emailHref}>Email</a>}
        <button type="button" className="portfolio-text-action" onClick={() => void copy(email, "Email address")}>Copy email</button>
      </div>
    </div>}
    <p role="status" className="portfolio-contact-status">{notice}</p>
  </div>;
}
