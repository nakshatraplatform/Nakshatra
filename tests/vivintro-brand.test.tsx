// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VivIntroBrand } from "@/components/brand/VivIntroBrand";

describe("VivIntroBrand", () => {
  it("uses the compact primary artwork for an explicitly toned home link", () => {
    render(<VivIntroBrand href="/" tone="primary" />);

    const link = screen.getByRole("link", { name: "VivIntro home" });
    expect(link).toHaveAttribute("href", "/");
    expect(link.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("/brand/vivintro/vivintro-symbol-compact-primary.svg"),
    );
    expect(link.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("provides primary and reverse artwork for theme-adaptive placement", () => {
    const { container } = render(<VivIntroBrand variant="stacked" decorative />);

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", expect.stringContaining("vivintro-lockup-stacked-primary.svg"));
    expect(images[1]).toHaveAttribute("src", expect.stringContaining("vivintro-lockup-stacked-reverse.svg"));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("announces an unlinked, meaningful mark once", () => {
    render(<VivIntroBrand variant="wordmark" tone="monochrome" />);

    expect(screen.getByRole("img", { name: "VivIntro" })).toBeInTheDocument();
  });
});
