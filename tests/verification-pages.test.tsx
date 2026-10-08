// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({ getApiUser: vi.fn().mockResolvedValue({ status: "missing_session" }) }));
import VerificationResultPage, { metadata as resultMetadata } from "@/app/verification/result/page";
import VerifyPage, { metadata as verifyMetadata } from "@/app/verify/[token]/page";

describe("verification pages", () => {
  it("keeps the provider return page non-authoritative and no-index", async () => {
    render(await VerificationResultPage());
    expect(screen.getByText("Your liveness result")).toBeInTheDocument();
    expect(screen.getByText(/Returning from Didit does not confirm approval/)).toBeInTheDocument();
    expect(resultMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("renders a dynamic opaque-token page", async () => {
    render(await VerifyPage({ params: Promise.resolve({ token: "opaque-token" }) }));
    expect(verifyMetadata.robots).toEqual({ index: false, follow: false });
  });
});
