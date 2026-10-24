// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Guide, { metadata } from "../src/app/guides/marriage-biodata-format/page";
import sitemap from "../src/app/sitemap";

describe("marriage biodata guide", () => {
  it("answers format and privacy questions without promising secret links", () => {
    render(<Guide />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/marriage biodata format/i);
    expect(screen.getByRole("heading", { level: 2, name: "What to include" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "What to keep private" })).toBeInTheDocument();
    expect(screen.getByText(/anyone with an active link can read the public view/i)).toBeInTheDocument();
    expect(screen.getByText(/copies already saved cannot be recalled/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see a sample introduction/i })).toHaveAttribute("href", "/demo");
    expect(screen.getByRole("link", { name: /create your introduction/i })).toHaveAttribute("href", "/signup");
  });

  it("is discoverable with one canonical URL", () => {
    expect(metadata.alternates?.canonical).toBe("/guides/marriage-biodata-format");
    expect(sitemap().filter(item => item.url.endsWith("/guides/marriage-biodata-format"))).toHaveLength(1);
  });
});
