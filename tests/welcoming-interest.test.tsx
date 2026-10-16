// @vitest-environment jsdom

import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startAuthentication = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth/client/auth.api", () => ({
  startAuthentication,
  verifyAuthenticationCode: vi.fn(),
  continueToAuthProvider: vi.fn(),
}));

import { InterestRequestModal } from "@/components/portfolio/InterestRequestModal";

describe("welcoming interest journey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    startAuthentication.mockResolvedValue({ ok: false, body: { error: "Please try again." } });
  });

  it("offers password sign-in and Google without asking for the account email twice", () => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    expect(screen.getByRole("link", { name: "Sign in to VivIntro" })).toHaveAttribute("href", "/login?redirect=%2Fp%2Fportfolio-token%23portfolio-interest");
    expect(screen.queryByLabelText("Registered email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it.each(["button", "Escape"])("retains incomplete answers after closing by %s and reopening", (method) => {
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="mira@example.com" />);
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
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="mira@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    const contacting = screen.getByLabelText("Who are you contacting for?");
    fireEvent.change(contacting, { target: { value: "son" } });
    fireEvent.change(screen.getByLabelText("Candidate’s full name"), { target: { value: "Arun" } });
    fireEvent.change(contacting, { target: { value: "self" } });
    expect(screen.queryByRole("group", { name: "Candidate details" })).not.toBeInTheDocument();
    fireEvent.change(contacting, { target: { value: "son" } });
    expect(within(screen.getByRole("group", { name: "Candidate details" })).getByLabelText("Candidate’s full name")).toHaveValue("Arun");
  });

  it("retains a corrected existing-profile location after session recovery goes back to details", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="mira@example.com" existingViewerProfile={{ name: "Mira Rao", profileFor: "self", phone: "", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    const location = within(screen.getByRole("group", { name: "Your location" }));
    fireEvent.click(location.getByRole("button", { name: "Change" }));
    fireEvent.click(location.getByRole("button", { name: "Enter location manually" }));
fireEvent.change(location.getByRole("combobox", { name: "State" }), { target: { value: "US-MA" } });
    fireEvent.change(location.getByRole("textbox", { name: "City" }), { target: { value: "Quincy" } });
    fireEvent.change(location.getByRole("textbox", { name: "ZIP or PIN code" }), { target: { value: "02171" } });
    fireEvent.change(screen.getByLabelText("Family context"), { target: { value: "Our family values kindness, honesty and mutual respect." } });
    fireEvent.click(screen.getByRole("button", { name: "Send interest" }));
    expect(await screen.findByRole("heading", { name: "Verify your email" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Change details" }));
    expect(location.getByRole("textbox", { name: "City" })).toHaveValue("Quincy");
    expect(location.getByRole("textbox", { name: "ZIP or PIN code" })).toHaveValue("02171");
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({ city: "Quincy", postalCode: "02171" });
  });

  it("does not dismiss or duplicate an in-flight submission and clears the form after success", async () => {
    let complete!: (response: Response) => void;
    const request = vi.fn(() => new Promise<Response>(resolve => { complete = resolve; }));
    vi.stubGlobal("fetch", request);
    render(<InterestRequestModal portfolioToken="portfolio-token" profileName="Ananya Rao" authenticated verifiedEmail="mira@example.com" existingViewerProfile={{ name: "Mira Rao", profileFor: "self", phone: "", country: "United States", countryCode: "US", state: "Massachusetts", subdivisionCode: "US-MA", city: "Boston", postalCode: "02108" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show interest" }));
    fireEvent.change(screen.getByLabelText("Family context"), { target: { value: "Our family values kindness, honesty and mutual respect." } });
    fireEvent.click(screen.getByRole("button", { name: "Send interest" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sending interest" })).toBeDisabled();
    complete(new Response('{"ok":true}', { status: 201 }));
    expect(await screen.findByRole("heading", { name: "Request sent", level: 2 })).toBeInTheDocument();
    expect(screen.queryByLabelText("Family context")).not.toBeInTheDocument();
  });
});
