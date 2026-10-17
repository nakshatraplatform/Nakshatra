// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadIntroductionPdf } from "../src/components/portfolio/DownloadIntroductionPdf";
import PdfIntroductionUnavailable from "../src/app/i/[code]/not-found";

afterEach(() => vi.unstubAllGlobals());
describe("dashboard PDF action", () => {
  it("provides a neutral unavailable destination without disclosing profile status", () => {
    render(<PdfIntroductionUnavailable />);
    expect(screen.getByRole("heading", { name: "Introduction unavailable" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Read the viewer guide" })).toHaveAttribute("href", "/received-a-link");
    expect(screen.queryByText(/deleted|unpublished|rotated/i)).not.toBeInTheDocument();
  });
  it("locks while preparing, then shows a recoverable error without losing the dashboard", async () => {
    let resolve!: (response: Response) => void;
    const fetch = vi.fn(() => new Promise<Response>(r => { resolve = r; })); vi.stubGlobal("fetch", fetch);
    render(<DownloadIntroductionPdf />);
    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    expect(screen.getByRole("button", { name: "Preparing PDF…" })).toBeDisabled();
    await act(async () => resolve(Response.json({ error: "Publish your introduction first." }, { status: 409 })));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publish your introduction first."));
    expect(screen.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });
});
