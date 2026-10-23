// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { BlueprintForm } from "../src/components/portfolio/BlueprintForm";
import type { PortfolioData } from "../src/types/portfolio";
import { incomeRangeOptions, SIBLING_POSITION_OPTIONS } from "../src/features/portfolio/blueprint-options";

const completeBlueprint: PortfolioData = {
  privacy_mode: "balanced",
  personal: {
    name: "Aditi Rao",
    first_name: "Aditi",
    middle_name: "",
    last_name: "Rao",
    dob: "1996-08-12",
    gender: "female",
    profile_for: "self",
    short_bio: "Warm, grounded, and curious.",
    profile_summary: "A thoughtful introduction",
    place_of_birth: "Bengaluru",
    current_location: "Boston, Massachusetts, United States",
    country: "United States",
    country_code: "US",
    region: "Massachusetts",
    region_code: "US-MA",
    city: "Boston",
    postal_code: "02108",
    location_source: "manual",
    address_line_1: "100 Hancock Street",
    address_line_2: "Unit 12",
    immigration_status: "H1B",
  },
  vitals: { height: `5'5"`, gotra: "Kashyap" },
  education: { degree: "MS", institution: "Northeastern", location: "Boston" },
  career: { title: "Engineer", company: "Nakshatra", location: "Boston", annual_income: "100k-125k", income_currency: "USD" },
  family: {
    father: { name: "Rao", occupation: "Engineer" },
    mother: { name: "Lakshmi", occupation: "Teacher" },
    paternal_origin: "Mysuru",
    maternal_origin: "Bengaluru",
    sibling_count: 1,
    siblings: [{ name: "Maya", occupation: "Designer" }],
  },
  lifestyle: { languages: "English, Telugu", hobbies: "Reading" },
  preferences: { narrative: "A kind and curious partnership", age_range: "24–28", height_range: `5'0"–5'8"` },
  astrology: {
    rashi: "kanya",
    nakshatra: "Uttara Phalguni",
    pada: "2",
    time_of_birth: "09:15",
    lagnam: "Mithuna",
    maternal_gotra: "Bharadwaj",
    manglik_status: "No",
  },
  contact: {
    contacts: [{ relationship: "father", name: "Rao", phone: "+91 90000 00000" }],
  },
  style: { appearance: "light", template_name: "Celestial Union" },
};

describe("blueprint form", () => {
  it.each(["Mysuru", ""])("replaces the legacy origin alias only when its visible answer is explicitly edited to %s", (value) => {
    const onUpdate = vi.fn();
    const legacy = { ...completeBlueprint, family: { ancestral_origin: "x".repeat(201), maternal_origin: "Bengaluru" } };
    const { rerender } = render(<BlueprintForm data={legacy} onUpdate={onUpdate} activeSection="family" />);
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Paternal family origin"), { target: { value } });
    expect(onUpdate).toHaveBeenLastCalledWith("family", { ancestral_origin: value, paternal_origin: value, maternal_origin: "Bengaluru" });
    const family = onUpdate.mock.calls.at(-1)![1];
    rerender(<BlueprintForm data={{ ...legacy, family }} onUpdate={onUpdate} activeSection="family" />);
    expect(screen.getByLabelText("Paternal family origin")).toHaveValue(value);
  });
  it("keeps typed list answers in the private draft without requiring Add", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} activeSection="story" />);
    fireEvent.change(screen.getByLabelText("Languages"), { target: { value: "Kannada" } });
    expect(onUpdate).toHaveBeenLastCalledWith("lifestyle", expect.objectContaining({ languages: "English, Telugu, Kannada" }));
    const saved = { ...completeBlueprint, lifestyle: { ...completeBlueprint.lifestyle, languages: "English, Telugu, Kannada" } };
    rerender(<BlueprintForm data={saved} onUpdate={onUpdate} activeSection="work" />);
    rerender(<BlueprintForm data={saved} onUpdate={onUpdate} activeSection="story" />);
    expect(screen.getByRole("button", { name: "Remove Kannada" })).toBeInTheDocument();
  });

  it("targets the self-described answer rather than only its dropdown", () => {
    render(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, community: "My roots" } }}
      onUpdate={vi.fn()} activeSection="family" validationIssues={[{ path: "personal.community", label: "Community", section: "family", message: "Shorten this answer." }]} />);
    expect(screen.getByLabelText("Describe your community or background")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Describe your community or background")).toHaveAttribute("id", "portfolio-answer-personal-community");
  });

  it("allows an unanswered sibling count without silently converting it to zero", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={{ ...completeBlueprint, family: { sibling_count: 0, siblings: [] } }} onUpdate={onUpdate} activeSection="family" />);
    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "" } });
    expect(onUpdate).toHaveBeenLastCalledWith("family", expect.objectContaining({ sibling_count: undefined }));
  });
  it("keeps name inputs concise and moves the public-link disclosure to sharing settings", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="foundation" />);
    expect(screen.queryByText(/Your full name appears/)).not.toBeInTheDocument();
    rerender(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="privacy" />);
    expect(screen.getByRole("group", { name: "Public sharing" })).toHaveTextContent(/full name/);
    expect(screen.getByRole("group", { name: "Public sharing" })).toHaveTextContent(/may be guessed/);
    expect(screen.getByRole("group", { name: "Introduction appearance" })).toHaveTextContent(/not your workspace/);
    expect(screen.getByRole("group", { name: /Private contact/ })).toHaveTextContent(/may save/);
    expect(screen.queryByText("Sensitive details stay protected")).not.toBeInTheDocument();
    expect(screen.queryByText("Who can see what")).not.toBeInTheDocument();
  });

  it("explains optional astrology once without repeating introductory panels", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="astrology" />);
    expect(screen.getByText("Optional", { exact: true })).toBeVisible();
    expect(screen.getByText("Leave unknown details blank.")).toBeVisible();
    expect(screen.queryByText(/Optional section · Answer only/)).not.toBeInTheDocument();
    expect(screen.queryByText("No guessing required")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Moon sign (Rashi)")).not.toHaveAccessibleDescription(/Leave blank/);
  });
  it("retains a self-described legacy answer and can clear it without any option lookup request", () => {
    function Editor() {
      const [data, setData] = useState({ ...completeBlueprint, personal: { ...completeBlueprint.personal, religion: "My own outlook" } });
      return <BlueprintForm data={data} initialSection="family" onUpdate={(key, value) => setData(current => ({ ...current, [key]: value }))} />;
    }
    render(<Editor />);
    expect(screen.getByLabelText("Describe your religion or outlook")).toHaveValue("My own outlook");
    fireEvent.change(screen.getByLabelText("Religion or outlook"), { target: { value: "Hindu" } });
    fireEvent.change(screen.getByLabelText("Religion or outlook"), { target: { value: "Other" } });
    expect(screen.getByLabelText("Describe your religion or outlook")).toHaveValue("My own outlook");
    fireEvent.change(screen.getByLabelText("Religion or outlook"), { target: { value: "" } });
    expect(screen.getByLabelText("Religion or outlook")).toHaveValue("");
    expect(fetch).not.toHaveBeenCalled();
    expect(SIBLING_POSITION_OPTIONS.some(option => option.value === "Only Child")).toBe(false);
  });

  it("uses readable currency-specific labels without rewriting stored ranges", () => {
    expect(incomeRangeOptions("USD")).toContainEqual({ value: "100k-125k", label: "100,000-125,000 USD per year" });
    expect(incomeRangeOptions("")).toContainEqual({ value: "Under 25k", label: "Under 25,000 per year" });
    expect(incomeRangeOptions("INR")).toContainEqual({ value: "5–10 lakh", label: "5–10 lakh INR per year" });
    render(<BlueprintForm data={{ ...completeBlueprint, career: { ...completeBlueprint.career, income_currency: "INR" } }} initialSection="work" onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Annual income range")).toHaveValue("100k-125k");
    expect(screen.getByRole("option", { name: "100k-125k (current)" })).toBeInTheDocument();
  });
  it("offers a bounded community self-description and remembers it across section changes", () => {
    function Editor() {
      const [data, setData] = useState(completeBlueprint);
      return <BlueprintForm data={data} initialSection="family" onUpdate={(key, value) => setData(current => ({ ...current, [key]: value }))} />;
    }
    render(<Editor />);
    const community = () => screen.getByRole("combobox", { name: "Community or cultural background" });
    fireEvent.change(community(), { target: { value: "Other / self-describe" } });
    const custom = screen.getByLabelText("Describe your community or background");
    expect(custom).toHaveAttribute("maxlength", "150");
    fireEvent.change(custom, { target: { value: "My cultural roots" } });
    fireEvent.change(community(), { target: { value: "Prefer not to say" } });
    expect(screen.queryByLabelText("Describe your community or background")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Family/ }));
    fireEvent.change(community(), { target: { value: "Other / self-describe" } });
    expect(screen.getByLabelText("Describe your community or background")).toHaveValue("My cultural roots");
  });

  it("requires confirmation before reinterpreting an existing income in a new currency", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    function Editor() {
      const [data, setData] = useState(completeBlueprint);
      return <BlueprintForm data={data} initialSection="work" onUpdate={(key, value) => setData(current => ({ ...current, [key]: value }))} />;
    }
    render(<Editor />);
    fireEvent.change(screen.getByLabelText("Income currency"), { target: { value: "INR" } });
    expect(screen.getByLabelText("Income currency")).toHaveValue("USD");
    expect(screen.getByLabelText("Annual income range")).toHaveValue("100k-125k");
    fireEvent.change(screen.getByLabelText("Income currency"), { target: { value: "INR" } });
    expect(screen.getByLabelText("Income currency")).toHaveValue("INR");
    expect(screen.getByLabelText("Annual income range")).toHaveValue("");
    expect(screen.getByRole("option", { name: "5–10 lakh INR per year" })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it("confirms removal of populated sibling details and retains historical position answers", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const onUpdate = vi.fn();
    render(<BlueprintForm data={{ ...completeBlueprint, family: { ...completeBlueprint.family, sibling_position: "Only Child" } }} initialSection="family" onUpdate={onUpdate} />);
    expect(screen.getByLabelText("Your position among siblings")).toHaveValue("Only Child");
    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "0" } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "0" } });
    expect(onUpdate).toHaveBeenCalledWith("family", expect.objectContaining({ sibling_count: 0, siblings: [] }));
    confirm.mockRestore();
  });
  it("preserves a space while typing a multi-word first name", () => {
    function Editor() {
      const [data, setData] = useState(completeBlueprint);
      return <BlueprintForm data={data} onUpdate={(key, value) => setData(current => ({ ...current, [key]: value }))} />;
    }
    render(<Editor />);
    const name = screen.getByLabelText("First name");
    fireEvent.change(name, { target: { value: "Mary " } });
    expect(name).toHaveValue("Mary ");
    fireEvent.change(name, { target: { value: "Mary Jane" } });
    expect(name).toHaveValue("Mary Jane");
  });
  it("navigates tag suggestions with virtual focus and selects with Enter", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} activeSection="story" onSectionChange={vi.fn()} />);
    const input = screen.getByRole("combobox", { name: "Values that matter to you" });
    input.focus();
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const selected = screen.getAllByRole("option").find(option => option.getAttribute("aria-selected") === "true")!;
    expect(selected).toBeDefined();
    expect(input).toHaveAttribute("aria-activedescendant", selected.id);
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onUpdate).toHaveBeenCalledWith("lifestyle", expect.objectContaining({ values_statement: selected.textContent }));
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });
  it("bounds typed answers to the accepted field lengths", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="foundation" onSectionChange={vi.fn()} />);
    expect(screen.getByLabelText("Current profession title", { exact: true })).toHaveAttribute("maxlength", "200");
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Enter location manually" }));
    expect(screen.getByLabelText("Current city", { exact: true })).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("First name", { exact: true })).toHaveAttribute("pattern", expect.stringContaining("\\-"));
    rerender(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="astrology" onSectionChange={vi.fn()} />);
    expect(screen.getByLabelText("Lagnam", { exact: true })).toHaveAttribute("maxlength", "100");
    rerender(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="privacy" onSectionChange={vi.fn()} />);
    expect(screen.getByLabelText("Name of contact", { exact: true })).toHaveAttribute("maxlength", "100");
  });
  it("lets the controlled editor own scrolling when changing sections", () => {
    const onSectionChange = vi.fn();
    const scrollIntoView = vi.fn();
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} activeSection="foundation" onSectionChange={onSectionChange} />);
    document.getElementById("blueprint-stage")!.scrollIntoView = scrollIntoView;
    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    expect(onSectionChange).toHaveBeenCalledWith("work");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
  it("keeps useful hints below controls and uses a shared protected-field legend", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    const dob = screen.getByLabelText("Date of birth", { exact: true });
    const hint = screen.getByText(/You must be at least 18/);
    expect(dob.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dob).toHaveAccessibleDescription(/You must be at least 18/);
    expect(screen.queryByText("Required to publish and shown in your public Introduction.")).not.toBeInTheDocument();
    expect(screen.getByText(/Private · Shared with your approval/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    const employer = screen.getByLabelText("Employer or organisation", { exact: true });
    expect(employer).toHaveAccessibleDescription(/Shared with your approval/);
    expect(screen.queryByText("Shared when you choose", { exact: true })).not.toBeInTheDocument();
  });
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ options: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
  });

  it("hides the self-creation selector while explaining an existing delegated draft", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    expect(screen.queryByLabelText("Who is creating this portfolio?")).not.toBeInTheDocument();
    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, profile_for: "daughter" } }} onUpdate={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Your draft remains private");
    expect(screen.queryByLabelText("Who is creating this portfolio?")).not.toBeInTheDocument();
  });

  it("marks gender and height required and validates entered name characters", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    expect(screen.getByLabelText("Gender")).toBeRequired();
    expect(screen.getByLabelText("Height")).toBeRequired();
    expect(screen.getByLabelText("First name")).toHaveAttribute("maxLength", "50");
    expect(screen.getByLabelText("Date of birth")).toHaveAttribute("min", "1920-01-01");
    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, first_name: "Aditi2" } }} onUpdate={vi.fn()} />);
    fireEvent.blur(screen.getByLabelText("First name"));
    expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Use letters, spaces, apostrophes or hyphens only/)).toBeInTheDocument();
  });

  it("guides optional narratives with an example and maximum but no minimum length", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Personal story/ }));
    expect(screen.getByLabelText("How would your close friends describe you?")).toHaveAttribute("maxLength", "1600");
    fireEvent.click(screen.getAllByText("See a good example")[0]);
    expect(screen.getByText(/brings friends together for a relaxed meal/)).toBeVisible();
    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, profile_summary: "Good person" } }} onUpdate={vi.fn()} />);
    fireEvent.blur(screen.getByLabelText("How would your close friends describe you?"));
    expect(screen.getByLabelText("How would your close friends describe you?")).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(/at least 80 characters/)).not.toBeInTheDocument();
  });

  it("explains ambiguous education and family fields without changing what is shared", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    expect(screen.getByLabelText("Education location")).toHaveAccessibleDescription("City, state or region, and country where you studied.");
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /04Family/ }));
    expect(screen.getAllByText(/Place or region your family traces its roots to/)).toHaveLength(2);
  });

  it("limits interest chips to six and preserves an unsaved answer across sections", () => {
    function Harness() {
      const [draft, setDraft] = useState(completeBlueprint);
      return <BlueprintForm data={draft} onUpdate={(section, value) => setDraft((current) => ({ ...current, [section]: value }))} />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "An unsaved but retained answer" } });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Personal story/ }));
    const interests = screen.getByRole("combobox", { name: "Select up to 6 Interests" });
    for (const item of ["Cooking", "Music", "Reading", "Hiking", "Travel", "Art"]) {
      fireEvent.change(interests, { target: { value: item } });
      fireEvent.keyDown(interests, { key: "Enter" });
    }
    expect(screen.getByText("6 of 6 selected")).toBeInTheDocument();
    expect(interests).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove Cooking" }));
    expect(interests).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Basics/ }));
    expect(screen.getByLabelText("Short description")).toHaveValue("An unsaved but retained answer");
  });

  it("offers clear Marital Status choices while retaining a prior saved answer", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    const maritalStatus = screen.getByLabelText("Marital Status");
    expect(within(maritalStatus).getByRole("option", { name: "Never married" })).toHaveValue("Single");
    expect(within(maritalStatus).getByRole("option", { name: "Married" })).toBeInTheDocument();

    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, marital_status: "Never Married" } }} onUpdate={vi.fn()} />);
    expect(within(screen.getByLabelText("Marital Status")).getByRole("option", { name: "Never Married (previous answer)" })).toBeInTheDocument();
  });

  it("collects identity before location and separates education, work and residency", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    const before = (first: HTMLElement, next: HTMLElement) => expect(first.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    before(screen.getByLabelText("Last name"), screen.getByLabelText("Date of birth"));
    before(screen.getByLabelText("Marital Status"), screen.getByText("Selected location"));
    before(screen.getByText("Selected location"), screen.getByLabelText("Current profession title"));
    expect(screen.queryByLabelText("Street address line 1")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Street address line 2")).not.toBeInTheDocument();
    before(screen.getByLabelText("Current profession title"), screen.getByLabelText("Short description"));
    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    expect(within(screen.getByRole("group", { name: "Education" })).getByLabelText("Institution")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Current work" })).getByLabelText("Work status")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Citizenship and residency" })).getByLabelText("Citizenship")).toBeInTheDocument();
    before(screen.getByLabelText("Education location"), screen.getByLabelText("Work status"));
    fireEvent.click(screen.getByRole("button", { name: /Astrology/ }));
    before(screen.getByLabelText("Place of birth"), screen.getByLabelText("Time of birth"));
  });

  it("routes required profile, family, contact, appearance, and privacy changes", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} />);

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Updated" } });
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "A concise new bio" } });
    fireEvent.click(screen.getByRole("button", { name: /Astrology/ }));
    fireEvent.change(screen.getByLabelText("Moon sign (Rashi)"), { target: { value: "kumbha" } });
    fireEvent.click(screen.getByRole("button", { name: /Family/ }));
    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: /Appearance & contact/ }));
    fireEvent.change(screen.getAllByLabelText("Name of contact")[0], { target: { value: "Updated Contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(onUpdate).toHaveBeenCalledWith("personal", expect.objectContaining({ first_name: "Updated", name: "Updated Rao" }));
    expect(onUpdate).toHaveBeenCalledWith("personal", expect.objectContaining({ short_bio: "A concise new bio" }));
    expect(onUpdate).toHaveBeenCalledWith("personal", expect.objectContaining({ address_line_1: completeBlueprint.personal.address_line_1 }));
    expect(onUpdate).toHaveBeenCalledWith("astrology", expect.objectContaining({ rashi: "kumbha" }));
    expect(onUpdate).toHaveBeenCalledWith("family", expect.objectContaining({ sibling_count: 2 }));
    expect(onUpdate).toHaveBeenCalledWith("contact", expect.objectContaining({
      contacts: [expect.objectContaining({ name: "Updated Contact" })],
    }));
    expect(onUpdate).toHaveBeenCalledWith("style", expect.objectContaining({
      appearance: "dark",
      theme_color: "#121a21",
      template_name: "Nakshatra Portfolio",
    }));
  });

  it("renders a safe minimal draft and grows dynamic sibling and contact groups", () => {
    const onUpdate = vi.fn();
    const minimal: PortfolioData = {
      privacy_mode: "private",
      personal: { name: "", dob: "", gender: "prefer_not_to_say" },
    };
    const { rerender } = render(<BlueprintForm data={minimal} onUpdate={onUpdate} />);

    expect(screen.getByText("Basics: 1 of 10 checks complete")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 7 · Basics")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continue: Personal story & lifestyle/ })).toHaveClass("dashboard-primary-action");
    fireEvent.click(screen.getByRole("button", { name: "Next section" }));
    expect(screen.getByRole("heading", { name: "Personal story" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous section" }));
    expect(screen.getByRole("heading", { name: "The essentials" })).toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText("First name"));
    expect(screen.getByText("This field is required.")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Date of birth")).toHaveAttribute("max");
    rerender(<BlueprintForm data={{ ...minimal, personal: { ...minimal.personal, dob: "2020-01-01" } }} onUpdate={onUpdate} />);
    fireEvent.blur(screen.getByLabelText("Date of birth"));
    expect(screen.getByText("You must be 18 or older.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Appearance & contact/ }));
    expect(screen.getByRole("button", { name: "Update sharing setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Name of contact")).not.toBeInTheDocument();
    expect(screen.getByText(/contacts stay out of the public Introduction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Family/ }));
    expect(screen.getByText("Optional", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Sibling 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "1" } });
    expect(onUpdate).toHaveBeenCalledWith("family", expect.objectContaining({
      sibling_count: 1,
      siblings: [{}],
    }));
    fireEvent.click(screen.getByRole("button", { name: /Appearance & contact/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add a private contact" }));
    expect(onUpdate).toHaveBeenCalledWith("contact", expect.objectContaining({
      contacts: [expect.objectContaining({ relationship: "self" })],
    }));
  });

  it("explains audience, supports chips, and reveals conditional preferences", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} />);

    const sectionNavigation = screen.getByRole("navigation", { name: "Introduction form sections" });
    const sectionLabels = within(sectionNavigation).getAllByRole("button").map((button) => button.textContent);
    expect(sectionLabels).toHaveLength(7);
    expect(sectionLabels.map((label) => label?.replace(/\s+/g, " "))).toEqual([
      expect.stringContaining("Basics"),
      expect.stringContaining("Personal story & lifestyle"),
      expect.stringContaining("Education & work"),
      expect.stringContaining("Family"),
      expect.stringContaining("Astrology & horoscope"),
      expect.stringContaining("Match & future"),
      expect.stringContaining("Appearance & contact"),
    ]);
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Education & work/ }));
    fireEvent.change(screen.getByLabelText("Annual income range"), { target: { value: "125k-150k" } });
    expect(onUpdate).toHaveBeenCalledWith("career", expect.objectContaining({ annual_income: "125k-150k" }));

    fireEvent.click(screen.getByRole("button", { name: /Personal story & lifestyle/ }));
    fireEvent.change(screen.getByLabelText("Languages"), { target: { value: "Kannada" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add" })[0]);
    expect(onUpdate).toHaveBeenCalledWith("lifestyle", expect.objectContaining({
      languages: "English, Telugu, Kannada",
    }));
    fireEvent.focus(screen.getByLabelText("Select up to 6 Interests"));
    expect(screen.getByRole("listbox", { name: "Select up to 6 Interests suggestions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Photography" }));
    expect(onUpdate).toHaveBeenCalledWith("lifestyle", expect.objectContaining({
      hobbies: "Reading, Photography",
    }));
    fireEvent.focus(screen.getByLabelText("Values that matter to you"));
    fireEvent.click(screen.getByRole("option", { name: "Kindness" }));
    expect(onUpdate).toHaveBeenCalledWith("lifestyle", expect.objectContaining({
      values_statement: "Kindness",
    }));

    fireEvent.click(within(sectionNavigation).getByRole("button", { name: /Match & future/i }));
    fireEvent.change(screen.getByLabelText("Minimum age"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Maximum height"), { target: { value: `5'10"` } });
    expect(onUpdate).toHaveBeenCalledWith("preferences", expect.objectContaining({ age_range: "25–28" }));
    expect(onUpdate).toHaveBeenCalledWith("preferences", expect.objectContaining({ height_range: `5'0"–5'10"` }));
    expect(screen.queryByLabelText("Preferred locations")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Specific communities")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Community preference"), { target: { value: "specific" } });
    expect(onUpdate).toHaveBeenCalledWith("preferences", expect.objectContaining({ caste_preference: "specific" }));
    rerender(<BlueprintForm data={{ ...completeBlueprint, preferences: { ...completeBlueprint.preferences, caste_preference: "specific" } }} onUpdate={onUpdate} />);
    expect(screen.getByLabelText("Specific communities")).toBeInTheDocument();
  });

  it("offers one public Introduction and an explicit upgrade for a legacy draft", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: /Appearance & contact/ }));
    expect(screen.getByRole("group", { name: "Public sharing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brief Introduction|Detailed Introduction/ })).not.toBeInTheDocument();
    rerender(<BlueprintForm data={{ ...completeBlueprint, privacy_mode: "private" }} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "Update sharing setup" }));
    expect(onUpdate).toHaveBeenCalledWith("privacy_mode", "balanced");
    expect(screen.queryByText("Visibility of selected introduction facts")).not.toBeInTheDocument();
  });

  it("keeps an independently selected maximum height from changing the minimum", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={{ ...completeBlueprint, preferences: {} }} onUpdate={onUpdate} />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Introduction form sections" })).getByRole("button", { name: /Match & future/i }));
    fireEvent.change(screen.getByLabelText("Maximum height"), { target: { value: `5'10"` } });

    expect(onUpdate).toHaveBeenCalledWith("preferences", expect.objectContaining({
      height_range: `–5'10"`,
    }));
  });

  it("uses concise future-plan choices and retires wedding transaction questions", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole("button", { name: /Match & future/ }));
    expect(screen.getByLabelText("How should careers be supported after marriage?")).toBeInTheDocument();
    expect(screen.getByLabelText("What living arrangement feels comfortable?")).toBeInTheDocument();
    expect(screen.getByLabelText("How should family responsibilities be handled?")).toBeInTheDocument();
    expect(screen.queryByLabelText("Wedding expenses and gift expectations")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What living arrangement feels comfortable?"), {
      target: { value: "Near family, in a separate home" },
    });
    expect(onUpdate).toHaveBeenCalledWith("preferences", expect.objectContaining({
      living_arrangement: "Near family, in a separate home",
    }));
  });

  it("marks publishing requirements and uses clear astrology terminology", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Astrology & horoscope/ }));

    for (const label of [
      "Time of birth",
      "Place of birth",
      "Moon sign (Rashi)",
      "Birth star (Nakshatra)",
      "Pada",
      "Gotra",
      "Manglik status",
    ]) {
      expect(screen.getByLabelText(label)).not.toBeRequired();
    }
    expect(screen.getByLabelText("Lagnam")).not.toBeRequired();
    expect(screen.getByLabelText("Maternal gotra")).not.toBeRequired();
    expect(screen.getByText("Leave unknown details blank.")).toBeInTheDocument();
    expect(screen.queryByText(/Shown in:/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Place of birth")).toHaveAccessibleDescription(/Shared with your approval/);
  });

  it("labels protected contact visibility once at the section level", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Appearance & contact/ }));

    const sectionNotice = screen.getByText("Private contact").parentElement;
    expect(sectionNotice).toHaveTextContent("Shared when you choose");
    for (const label of ["Who is this?", "Name of contact", "Phone number", "Email"]) {
      expect(screen.getByLabelText(label).closest("label")).not.toHaveTextContent("Shared when you choose");
    }
    expect(screen.getByLabelText("Country calling code")).toHaveValue("91");
    expect(screen.getByLabelText("Phone number")).toHaveValue("90000 00000");
  });
});
