// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { BlueprintForm } from "../src/components/portfolio/BlueprintForm";
import type { PortfolioData } from "../src/types/portfolio";

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
    region: "Massachusetts",
    city: "Boston",
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

  it("guides optional narrative answers with an accessible example and minimum length", () => {
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio form sections" })).getByRole("button", { name: /Personal story/ }));
    expect(screen.getByLabelText("How would your close friends describe you?")).toHaveAttribute("maxLength", "1600");
    fireEvent.click(screen.getAllByText("See a good example")[0]);
    expect(screen.getByText(/brings friends together for a relaxed meal/)).toBeVisible();
    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, profile_summary: "Good person" } }} onUpdate={vi.fn()} />);
    fireEvent.blur(screen.getByLabelText("How would your close friends describe you?"));
    expect(screen.getByText(/If you answer, write at least 80 characters/)).toBeInTheDocument();
  });

  it("limits interest chips to six and preserves an unsaved answer across sections", () => {
    function Harness() {
      const [draft, setDraft] = useState(completeBlueprint);
      return <BlueprintForm data={draft} onUpdate={(section, value) => setDraft((current) => ({ ...current, [section]: value }))} />;
    }
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Short description"), { target: { value: "An unsaved but retained answer" } });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio form sections" })).getByRole("button", { name: /Personal story/ }));
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
    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio form sections" })).getByRole("button", { name: /Personal story/ }));
    const maritalStatus = screen.getByLabelText("Marital Status");
    expect(within(maritalStatus).getByRole("option", { name: "Single" })).toBeInTheDocument();
    expect(within(maritalStatus).getByRole("option", { name: "Married" })).toBeInTheDocument();
    expect(within(maritalStatus).queryByRole("option", { name: /Never Married/ })).not.toBeInTheDocument();

    rerender(<BlueprintForm data={{ ...completeBlueprint, personal: { ...completeBlueprint.personal, marital_status: "Never Married" } }} onUpdate={vi.fn()} />);
    expect(within(screen.getByLabelText("Marital Status")).getByRole("option", { name: "Never Married (previous answer)" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Privacy & contact/ }));
    fireEvent.change(screen.getAllByLabelText("Name of contact")[0], { target: { value: "Updated Contact" } });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(onUpdate).toHaveBeenCalledWith("personal", expect.objectContaining({ first_name: "Updated", name: "Updated Rao" }));
    expect(onUpdate).toHaveBeenCalledWith("personal", expect.objectContaining({ short_bio: "A concise new bio" }));
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

    expect(screen.getByText(/1 of 11 required details complete/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Privacy & contact/ }));
    expect(screen.getByRole("button", { name: "Update sharing setup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Name of contact")).not.toBeInTheDocument();
    expect(screen.getByText(/contacts stay out of the public Introduction/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Family/ }));
    expect(screen.getByText(/Optional section/)).toBeInTheDocument();
    expect(screen.queryByText("Sibling 1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Number of siblings"), { target: { value: "1" } });
    expect(onUpdate).toHaveBeenCalledWith("family", expect.objectContaining({
      sibling_count: 1,
      siblings: [{}],
    }));
    fireEvent.click(screen.getByRole("button", { name: /Privacy & contact/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add a protected contact" }));
    expect(onUpdate).toHaveBeenCalledWith("contact", expect.objectContaining({
      contacts: [expect.objectContaining({ relationship: "self" })],
    }));
  });

  it("explains audience, supports chips, and reveals conditional preferences", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<BlueprintForm data={completeBlueprint} onUpdate={onUpdate} />);

    const sectionNavigation = screen.getByRole("navigation", { name: "Portfolio form sections" });
    const sectionLabels = within(sectionNavigation).getAllByRole("button").map((button) => button.textContent);
    expect(sectionLabels).toHaveLength(7);
    expect(sectionLabels.map((label) => label?.replace(/\s+/g, " "))).toEqual([
      expect.stringContaining("Basics"),
      expect.stringContaining("Personal story & lifestyle"),
      expect.stringContaining("Education & work"),
      expect.stringContaining("Family"),
      expect.stringContaining("Astrology & traditions"),
      expect.stringContaining("Match & future"),
      expect.stringContaining("Privacy & contact"),
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
    fireEvent.click(screen.getByRole("button", { name: /Privacy & contact/ }));
    expect(screen.getByText("Public Introduction")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brief Introduction|Detailed Introduction/ })).not.toBeInTheDocument();
    rerender(<BlueprintForm data={{ ...completeBlueprint, privacy_mode: "private" }} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole("button", { name: "Update sharing setup" }));
    expect(onUpdate).toHaveBeenCalledWith("privacy_mode", "balanced");
    expect(screen.queryByText("Visibility of selected introduction facts")).not.toBeInTheDocument();
  });

  it("keeps an independently selected maximum height from changing the minimum", () => {
    const onUpdate = vi.fn();
    render(<BlueprintForm data={{ ...completeBlueprint, preferences: {} }} onUpdate={onUpdate} />);

    fireEvent.click(within(screen.getByRole("navigation", { name: "Portfolio form sections" })).getByRole("button", { name: /Match & future/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /Astrology & traditions/ }));

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
    expect(screen.getByText("No guessing required")).toBeInTheDocument();
    expect(screen.queryByText(/Shown in:/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Shown after approval").length).toBeGreaterThan(0);
  });

  it("labels protected contact visibility once at the section level", () => {
    render(<BlueprintForm data={completeBlueprint} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Privacy & contact/ }));

    const sectionNotice = screen.getByText("Protected contact").parentElement;
    expect(sectionNotice).toHaveTextContent("Shown after approval");
    for (const label of ["Who is this?", "Name of contact", "Phone", "Email"]) {
      expect(screen.getByLabelText(label).closest("label")).not.toHaveTextContent("Shown after approval");
    }
  });
});
