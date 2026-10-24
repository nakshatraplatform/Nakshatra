// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use the shared matchMedia fixture for the static fallback; real animation
// lifecycle and scroll behavior are exercised in the browser suites.
vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; fill?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    delete imageProps.fill;
    return React.createElement("img", { alt: "", ...imageProps });
  },
}));
vi.mock("shaders/react", () => {
  const Part = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  return { Shader: Part, ChromaFlow: Part, FilmGrain: Part, FlutedGlass: Part, Swirl: Part };
});

import Home from "../src/app/page";
import { LandingExperience } from "../src/components/landing/LandingExperience";
import ErrorPage from "../src/app/error";
import NotFound from "../src/app/not-found";
import { RashiPalettePicker } from "../src/components/portfolio/RashiPalettePicker";
import { getRashiPalettes } from "../src/features/portfolio/rashi-theme";

describe("landing and shared frontend components", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the concise product promise, access model, and primary actions", () => {
    render(<Home />);
    expect(screen.getAllByText(/VivIntro/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /create your introduction/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Your marriage biodata, shared through one link/i })).toBeInTheDocument();
    expect(screen.getByText(/A simple way to introduce yourself/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Vivara.*link/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/private details/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Why Rahul started VivIntro/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Private until you publish/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/What does “Liveness checked” mean/i).closest("summary")).toBeInTheDocument();
    expect(screen.getByText(/every detail in the sample are fictional/i)).toBeInTheDocument();
  });

  it("offers distinct privacy and story-led landing concepts", () => {
    const { rerender } = render(<LandingExperience variant="control" />);
    expect(screen.getByRole("heading", { name: /Share your biodata. Choose when to share more/i })).toBeInTheDocument();
    expect(document.querySelector("#privacy")).toHaveTextContent(/viewer signs in and confirms their email/i);

    rerender(<LandingExperience variant="story" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Introduce yourself the way you want to be known/i);
    expect(screen.getByText(/Bring your story, family and photos together with VivIntro/i)).toBeInTheDocument();
  });

  it("handles empty, selected, disabled, and selectable rashi palettes", async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<RashiPalettePicker palettes={[]} onSelect={onSelect} />);
    expect(screen.getByText(/select a rashi/i)).toBeInTheDocument();

    const palettes = getRashiPalettes("tula");
    rerender(<RashiPalettePicker palettes={palettes} selectedPaletteId={palettes[0].id} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /pastel pink/i })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: /cream/i }));
    expect(onSelect).toHaveBeenCalledWith(palettes[1]);

    rerender(<RashiPalettePicker palettes={palettes} onSelect={onSelect} disabled />);
    expect(screen.getAllByRole("button")[0]).toBeDisabled();
  });

  it("renders and resets the error boundary and the not-found page", () => {
    const reset = vi.fn();
    const { rerender } = render(<ErrorPage error={new Error("boom")} reset={reset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(reset).toHaveBeenCalledOnce();
    rerender(<NotFound />);
    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });
});
