// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/components/theme/ThemeSwitch", () => ({ ThemeSwitch: () => <button type="button">Change theme</button> }));

import OnboardingFeedbackAdminClient from "../src/app/admin/onboarding-feedback/onboarding-feedback-admin-client";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows each private multi-select answer to the administrator", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ feedback: [{
    easeRating: 4,
    hardestSteps: ["details", "photos"],
    likedAspects: ["guidance", "privacy"],
    comment: "A useful note",
    submittedAt: "2026-10-05T12:00:00Z",
  }] }) }));

  render(<OnboardingFeedbackAdminClient />);
  expect(await screen.findByText("Writing my details, Adding photos")).toBeInTheDocument();
  expect(screen.getByText("Clear guidance, Privacy controls")).toBeInTheDocument();
  expect(screen.getByText("A useful note")).toBeInTheDocument();
});
