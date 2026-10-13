// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PortfolioImage } from "@/components/loading/PortfolioImage";

describe("visible portfolio image feedback", () => {
  it("stops the orb on load, restarts for a new URL and replaces it with recovery text on failure", () => {
    const view = render(<PortfolioImage key="one" src="/photo-one.webp" alt="First photo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading photo");
    fireEvent.load(screen.getByAltText("First photo"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    view.rerender(<PortfolioImage key="two" src="/photo-two.webp" alt="Second photo" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading photo");
    fireEvent.error(screen.getByAltText("Second photo"));
    expect(screen.getByRole("status")).toHaveTextContent("Photo could not load");
    expect(document.querySelector("canvas")).toBeNull();
  });

  it("does not add an orb for decorative thumbnail loads", () => {
    render(<PortfolioImage src="/thumbnail.webp" alt="" showLoading={false} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
