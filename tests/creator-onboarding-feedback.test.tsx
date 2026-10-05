// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByText(/private and never appears on your portfolio/i)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Send feedback" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "4" }));
    await user.selectOptions(screen.getByRole("combobox", { name: /which step was hardest/i }), "details");
    await user.type(screen.getByRole("textbox", { name: /what would make it better/i }), "A short example would help.");
    await user.click(submit);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith("/api/portfolio/onboarding-feedback", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ easeRating: 4, hardestStep: "details", comment: "A short example would help." }),
    }));
    expect(await screen.findByText(/your feedback is private/i)).toBeInTheDocument();
  });
});
