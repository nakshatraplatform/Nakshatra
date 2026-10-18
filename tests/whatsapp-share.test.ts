import { describe, expect, it } from "vitest";
import { buildWhatsAppShareMessage } from "@/features/portfolio/whatsapp-share";
import { interestStatusLabel, sharingStatusLabel } from "@/features/interest/presentation";

const url = "https://www.vivintro.com/p/example";

describe("public introduction WhatsApp text", () => {
  it("uses the full public name and omits any promise of maintenance", () => {
    const text = buildWhatsAppShareMessage(url, {
      personal: { name: "Rahul Gollapalli Ranganatha", age: 28, current_location: "Quincy, MA, United States" },
      career: { title: "Data Engineer" },
    });
    expect(text).toBe(`Here’s my marriage introduction 🙏\n\nRahul Gollapalli Ranganatha · 28 · Data Engineer · Quincy, USA\n${url}\n\nIf you’d like to know more, tap “Show interest” on the page.`);
    expect(text).not.toMatch(/always|latest|up to date|updated/i);
  });
  it("does not fill missing public fields with draft, private contact or exact birth details", () => {
    const text = buildWhatsAppShareMessage(url, { personal: { name: "Aditi Rao", dob: "1998-01-30", address_line_1: "Secret street", postal_code: "02171" }, contact: { email: "private@example.test" } });
    expect(text).toContain(`Aditi Rao\n${url}`);
    expect(text).not.toMatch(/1998|Secret|02171|private@example/);
    expect(text).not.toContain("undefined");
    expect(buildWhatsAppShareMessage(url)).toContain(`🙏\n\n${url}`);
  });
  it("respects public career visibility and preserves unknown locations without guessing", () => {
    expect(buildWhatsAppShareMessage(url, { personal: { name: "Alex", current_location: "Wellington" }, career: { title: "Secret role" }, visibility: { journey: "restricted" } })).not.toContain("Secret role");
    const text = buildWhatsAppShareMessage(url, { personal: { name: "Alex", city: "Bengaluru", country: "India" }, career: { title: "Secret role" }, access: { career: "approved" } });
    expect(text).not.toContain("Secret role");
    expect(text).toContain("Bengaluru, India");
  });
});

describe("warm status labels", () => {
  it.each([['new','Awaiting review'],['pending_review','Awaiting review'],['rejected','Set aside'],['approved','Details shared'],['revealed','Details shared'],['unknown','Closed']])("labels interest %s without changing its status", (status, label) => {
    expect(interestStatusLabel(status)).toBe(label);
  });
  it.each([['active','Sharing details'],['expired','Sharing period ended'],['revoked','Sharing stopped'],['unknown','Not sharing']])("labels sharing %s", (status, label) => {
    expect(sharingStatusLabel(status)).toBe(label);
  });
});
