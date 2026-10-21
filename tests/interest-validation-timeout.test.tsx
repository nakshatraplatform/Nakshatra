// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const lateValidation = vi.hoisted(() => {
  let resolve!: (value: unknown) => void;
  const promise = new Promise<unknown>(done => { resolve = done; });
  return { promise, resolve };
});
const startAuthentication = vi.hoisted(() => vi.fn());
vi.mock("@/features/interest/server/interest.contract", () => lateValidation.promise);
vi.mock("@/features/auth/client/auth.api", () => ({ startAuthentication, verifyAuthenticationCode: vi.fn(), continueToAuthProvider: vi.fn() }));
vi.mock("@/components/portfolio/LocationFields", () => ({ hasCompleteLocationHierarchy: () => true, LocationFields: () => null }));
import { InterestRequestModal } from "../src/components/portfolio/InterestRequestModal";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("bounds a stalled validation download, retains answers, and ignores its late completion", async () => {
  vi.useFakeTimers();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  const request = vi.fn(); vi.stubGlobal("fetch", request);
  render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue as a new visitor" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Rohan Mehta" } });
  fireEvent.submit(screen.getByRole("button", { name: "Verify email and continue" }).closest("form")!);
  await act(async () => { await vi.advanceTimersByTimeAsync(20_001); });
  expect(screen.getByRole("alert")).toHaveTextContent("could not check your details");
  expect(screen.getByRole("button", { name: "Verify email and continue" })).toBeEnabled();
  expect(screen.getByLabelText("Full name")).toHaveValue("Rohan Mehta");
  const safeParse = vi.fn();
  await act(async () => { lateValidation.resolve({ interestSubmissionSchema: { safeParse } }); });
  expect(safeParse).not.toHaveBeenCalled();
  expect(startAuthentication).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
