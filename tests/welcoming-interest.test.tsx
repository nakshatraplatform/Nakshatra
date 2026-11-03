// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startAuthentication = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/client/auth.api", () => ({
  startAuthentication,
  verifyAuthenticationCode: vi.fn(),
  continueToAuthProvider: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { InterestRequestModal } from "@/components/portfolio/InterestRequestModal";

describe("welcoming interest journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    startAuthentication.mockResolvedValue({ ok: false, body: { error: "Please try again." } });
  });

  it("shows a direct accountless form with a clear privacy promise", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in to VivIntro" })).not.toBeInTheDocument();
    expect(screen.getByText(/creates no account or VivIntro sign-in/)).toBeInTheDocument();
  });

  it.each(["button", "Escape"])("retains incomplete answers after closing by %s and reopening", (method) => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Mira" } });
    fireEvent.change(screen.getByLabelText("Who are you contacting for?"), { target: { value: "daughter" } });
    fireEvent.change(screen.getByLabelText("Candidate’s full name"), { target: { value: "Anika" } });
    fireEvent.change(screen.getByLabelText("Family context"), { target: { value: "Still writing" } });
    if (method === "button") fireEvent.click(screen.getByRole("button", { name: "Close interest form" }));
    else fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Mira");
    expect(screen.getByLabelText("Candidate’s full name")).toHaveValue("Anika");
    expect(screen.getByLabelText("Family context")).toHaveValue("Still writing");
    expect(screen.getByRole("group", { name: "About you" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Introduce yourself" })).toBeInTheDocument();
    expect(startAuthentication).not.toHaveBeenCalled();
  });

  it("keeps candidate answers when temporarily switching back to Myself", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    const contacting = screen.getByLabelText("Who are you contacting for?");
    fireEvent.change(contacting, { target: { value: "son" } });
    fireEvent.change(screen.getByLabelText("Candidate’s full name"), { target: { value: "Arun" } });
    fireEvent.change(contacting, { target: { value: "self" } });
    expect(screen.queryByRole("group", { name: "Candidate details" })).not.toBeInTheDocument();
    fireEvent.change(contacting, { target: { value: "son" } });
    expect(within(screen.getByRole("group", { name: "Candidate details" })).getByLabelText("Candidate’s full name")).toHaveValue("Arun");
  });

  it("falls back to a visitor form without reusing an unpublished member draft", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ available: false })));
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="mira@example.com" existingViewerProfile={{ name: "Mira Rao", profileFor: "self", phone: "+1 6175550123", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(await screen.findByLabelText("Full name")).toHaveValue("");
    expect(screen.getByLabelText("Email address")).toHaveValue("");
    expect(screen.getByText(/creates no account or VivIntro sign-in/)).toBeInTheDocument();
  });
});
