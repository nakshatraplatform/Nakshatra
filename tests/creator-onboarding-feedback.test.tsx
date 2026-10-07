// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreatorOnboardingFeedback } from "../src/components/feedback/CreatorOnboardingFeedback";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("completed-portfolio feedback", () => {
  it("keeps the form optional and sends only the bounded answers", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: null }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: "saved" }) });
    vi.stubGlobal("fetch", fetch);
    const user = userEvent.setup();
    render(<CreatorOnboardingFeedback />);

    expect(await screen.findByText(/it never appears on your portfolio/i)).toBeInTheDocument();
    expect(screen.getByText("Liveness checks")).toBeInTheDocument();
    const submit = await screen.findByRole("button", { name: "Send feedback" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.click(screen.getByText("Select one or more"));
    await user.click(screen.getByRole("checkbox", { name: "Writing my details" }));
    await user.click(screen.getByRole("checkbox", { name: "Adding photos" }));
    await user.click(screen.getByText("Select any you liked"));
    await user.click(screen.getByRole("checkbox", { name: "Clear guidance" }));
    await user.click(screen.getByRole("checkbox", { name: "Previewing my portfolio" }));
    await user.type(screen.getByRole("textbox", { name: /what would make it better/i }), "A short example would help.");
    await user.click(submit);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith("/api/portfolio/onboarding-feedback", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ easeRating: 4, hardestSteps: ["details", "photos"], likedAspects: ["guidance", "preview"], comment: "A short example would help." }),
    }));
    expect(await screen.findByText(/thank you for helping us improve vivintro/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send feedback" })).not.toBeInTheDocument();
  });

  it("does not show the form again after a saved response", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ feedback: {
      easeRating: 5, hardestSteps: ["photos", "publishing"], likedAspects: ["privacy"], comment: null,
    } }) });
    vi.stubGlobal("fetch", fetch);
    render(<CreatorOnboardingFeedback />);
    await act(async () => { await Promise.resolve(); });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /feedback/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/how was creating your portfolio/i)).not.toBeInTheDocument();
  });

  it("keeps Nothing stood out exclusive before submission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ feedback: null }) }));
    const user = userEvent.setup();
    render(<CreatorOnboardingFeedback />);
    await screen.findByRole("button", { name: "Send feedback" });
    await user.click(screen.getByText("Select one or more"));
    await user.click(screen.getByRole("checkbox", { name: "Adding photos" }));
    await user.click(screen.getByRole("checkbox", { name: "Understanding publishing" }));
    await user.click(screen.getByRole("checkbox", { name: "Nothing stood out" }));
    expect(screen.getByRole("checkbox", { name: "Adding photos" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Understanding publishing" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Nothing stood out" })).toBeChecked();
  });

  it("does not allow answers to change while a save is pending", async () => {
    let finishSave!: (value: unknown) => void;
    const pending = new Promise((resolve) => { finishSave = resolve; });
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ feedback: null }) })
      .mockReturnValueOnce(pending));
    const user = userEvent.setup();
    render(<CreatorOnboardingFeedback />);
    await screen.findByRole("button", { name: "Send feedback" });
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.click(screen.getByText("Select one or more"));
    await user.click(screen.getByRole("checkbox", { name: "Writing my details" }));
    await user.click(screen.getByRole("button", { name: "Send feedback" }));
    expect(screen.getByRole("radio", { name: "5" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Adding photos" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /what would make it better/i })).toBeDisabled();
    finishSave({ ok: true, json: async () => ({ status: "saved" }) });
    expect(await screen.findByText(/thank you for helping us improve vivintro/i)).toBeInTheDocument();
  });
});
