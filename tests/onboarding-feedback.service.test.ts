import { describe, expect, it, vi } from "vitest";

import {
  feedbackCommandSchema,
  getOwnOnboardingFeedback,
  listOnboardingFeedback,
  submitOnboardingFeedback,
} from "../src/features/feedback/server/onboarding-feedback.service";

const feedback = {
  easeRating: 4,
  hardestStep: "photos",
  comment: "A clearer photo example would help.",
  submittedAt: "2026-10-04T12:00:00Z",
};

function client(data: unknown, error: unknown = null) {
  return { rpc: vi.fn().mockResolvedValue({ data, error }) };
}

describe("onboarding feedback service", () => {
  it("accepts only bounded feedback commands", () => {
    expect(feedbackCommandSchema.parse({ easeRating: 4, hardestStep: "photos", comment: "  helpful  " }).comment).toBe("helpful");
    expect(feedbackCommandSchema.safeParse({ easeRating: 6, hardestStep: "photos" }).success).toBe(false);
    expect(feedbackCommandSchema.safeParse({ easeRating: 4, hardestStep: "photos", contact: "private" }).success).toBe(false);
  });

  it("returns the owner's feedback or null and rejects malformed database responses", async () => {
    const success = client(feedback);
    expect(await getOwnOnboardingFeedback(success as never)).toEqual(feedback);
    expect(success.rpc).toHaveBeenCalledWith("get_creator_onboarding_feedback");
    await expect(getOwnOnboardingFeedback(client(null) as never)).resolves.toBeNull();
    await expect(getOwnOnboardingFeedback(client({ ...feedback, easeRating: 9 }) as never)).rejects.toThrow();
    const dbError = { code: "42501" };
    await expect(getOwnOnboardingFeedback(client(null, dbError) as never)).rejects.toBe(dbError);
  });

  it("submits only the intended RPC arguments and requires a saved acknowledgement", async () => {
    const success = client({ status: "saved" });
    await expect(submitOnboardingFeedback(success as never, { easeRating: 4, hardestStep: "photos", comment: "  Useful  " })).resolves.toBeUndefined();
    expect(success.rpc).toHaveBeenCalledWith("submit_creator_onboarding_feedback", {
      p_ease_rating: 4, p_hardest_step: "photos", p_comment: "  Useful  ",
    });
    const noComment = client({ status: "saved" });
    await submitOnboardingFeedback(noComment as never, { easeRating: 5, hardestStep: "none" });
    expect(noComment.rpc).toHaveBeenCalledWith("submit_creator_onboarding_feedback", {
      p_ease_rating: 5, p_hardest_step: "none", p_comment: null,
    });
    const dbError = { code: "42501" };
    await expect(submitOnboardingFeedback(client(null, dbError) as never, { easeRating: 2, hardestStep: "details" })).rejects.toBe(dbError);
    for (const response of [null, "saved", { status: "queued" }]) {
      await expect(submitOnboardingFeedback(client(response) as never, { easeRating: 2, hardestStep: "details" }))
        .rejects.toThrow("Feedback persistence failed");
    }
  });

  it("lists only valid administrator results and forwards database denial", async () => {
    const success = client([feedback]);
    await expect(listOnboardingFeedback(success as never)).resolves.toEqual([feedback]);
    expect(success.rpc).toHaveBeenCalledWith("list_creator_onboarding_feedback", { p_limit: 50 });
    await expect(listOnboardingFeedback(client([]) as never)).resolves.toEqual([]);
    await expect(listOnboardingFeedback(client([{ ...feedback, submittedAt: 123 }]) as never)).rejects.toThrow();
    const dbError = { code: "42501" };
    await expect(listOnboardingFeedback(client(null, dbError) as never)).rejects.toBe(dbError);
  });
});
