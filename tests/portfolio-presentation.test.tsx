// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BriefcaseBusiness } from "lucide-react";
import { ChapterHeading, IconDataRow, Pill, ProtectedDataVault, TrustBadge } from "@/components/portfolio/presentation/PortfolioPrimitives";
import { ExpandableProse } from "@/components/portfolio/presentation/ExpandableProse";
import { PortfolioNav } from "@/components/portfolio/presentation/PortfolioNav";
import CelestialUnion from "@/components/templates/CelestialUnion";
import { formatPortfolioLocation, isPortfolioAudienceLocked, portfolioHobbies } from "@/features/portfolio/presentation";
import type { AccessData, PortfolioData } from "@/types/portfolio";

const data: PortfolioData = {
  personal: { name: "Alex", city: "Quincy", region_code: "US-MA", country: "United States" },
  career: { title: "Data Engineer", company: "Private company" },
  lifestyle: { hobbies: "Play Keyboard Instrument, Photography, Cooking, Traveling, Photography, ", languages: "English", values_statement: "Private values" },
  family: { public_summary: "Private family story" },
  astrology: { rashi: "kanya", nakshatra: "Private star" },
  contact: { contact_person: "Family", email: "private@example.test" },
};

describe("portfolio presentation mapping", () => {
  it("splits actual comma-separated hobbies without fabricated or empty pills", () => {
    expect(portfolioHobbies(data.lifestyle?.hobbies)).toEqual(["Play Keyboard Instrument", "Photography", "Cooking", "Traveling"]);
    expect(portfolioHobbies()).toEqual([]);
    render(<CelestialUnion data={data} sunSign={null} accessMode="public" />);
    expect(screen.getAllByText("Photography")).toHaveLength(1);
  });

  it.each([
    [{ name: "A", city: "Quincy", region_code: "US-MA", country: "United States", postal_code: "02171", address_line_1: "Private street" }, "Quincy, MA, United States"],
    [{ name: "A", city: "Quincy", region: "Massachusetts", country: "United States" }, "Quincy, MA, United States"],
    [{ name: "A", current_location: "Quincy, Massachusetts, United States" }, "Quincy, MA, United States"],
    [{ name: "A", city: "Bengaluru", region_code: "IN-KA", country: "India" }, "Bengaluru, KA, India"],
    [{ name: "A", city: "Paris", region: "Île-de-France", country: "France" }, "Paris, Île-de-France, France"],
    [{ name: "A", city: "Boston" }, "Boston"],
    [{ name: "A", current_location: " London " }, "London"],
    [{ name: "A", current_location: " " }, undefined],
  ])("formats authorized structured and legacy locations safely: %j", (personal, result) => {
    expect(formatPortfolioLocation(personal)).toBe(result);
  });

  it.each(["career", "family", "contact", "astrology"] as const)("does not treat %s audience metadata as an approval", (key) => {
    const access: AccessData = { [key]: "approved" };
    const value = { ...data, access };
    expect(isPortfolioAudienceLocked(value, key, "public")).toBe(true);
    expect(isPortfolioAudienceLocked(value, key, "approved")).toBe(false);
    expect(isPortfolioAudienceLocked(value, key, "owner")).toBe(false);
    expect(isPortfolioAudienceLocked({ ...value, access: { [key]: "owner" } }, key, "approved")).toBe(true);
    expect(isPortfolioAudienceLocked({ ...value, access: { [key]: "broker" } }, key, "public")).toBe(true);
    expect(isPortfolioAudienceLocked({ ...value, access: { [key]: "public" } }, key, "public")).toBe(false);
  });

  it("conceals locked content even if a caller accidentally supplies more fields", () => {
    render(<CelestialUnion data={{ ...data, access: { career: "approved", family: "approved", astrology: "approved", contact: "approved", lifestyle: "approved" } }} sunSign={null} accessMode="public" />);
    for (const value of ["Private company", "Private family story", "Private star", "private@example.test", "Photography", "Private values", "English", "Data Engineer"]) {
      expect(screen.queryByText(value, { exact: false })).not.toBeInTheDocument();
    }
    expect(screen.getByText("Family shared after approval")).toBeInTheDocument();
    expect(screen.getByText("Contact shared after approval")).toBeInTheDocument();
  });

  it("uses a vault instead of clear photos for restricted gallery metadata", () => {
    render(<CelestialUnion data={{ ...data, visibility: { gallery: "restricted" } }} sunSign={null} accessMode="public"
      photos={[{ id: "private", src: "https://example.test/photo", alt: "Private portrait", mediaType: "gallery", orientation: "portrait" }]} />);
    expect(screen.queryByAltText("Private portrait")).not.toBeInTheDocument();
    expect(screen.getByText("Photos shared after approval")).toBeInTheDocument();
  });

  it("keeps public rows and approved contact actions on their authorized paths", () => {
    render(<CelestialUnion data={{ ...data, access: { career: "public", family: "public", contact: "approved" } }} sunSign={null} accessMode="approved" />);
    expect(screen.getByRole("heading", { name: "Data Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:private%40example.test");
    expect(screen.getByText("Private family story")).toBeInTheDocument();
    expect(screen.getByText("Data Engineer, Quincy, MA, United States")).toBeInTheDocument();
  });
});

describe("portfolio micro-components", () => {
  it("groups the chapter number and eyebrow with a labelled display heading", () => {
    const { container } = render(<ChapterHeading number={2} eyebrow="Astrology" title="Cultural alignment" id="astrology-title" />);
    expect(screen.getByRole("heading", { level: 2, name: "Cultural alignment" })).toHaveAttribute("id", "astrology-title");
    expect(container.querySelector("p > span[aria-hidden=true]")).toHaveTextContent("02");
    expect(container.querySelector("p")).toHaveTextContent("Astrology");
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("keeps trust claims narrow and icon decorative", () => {
    const { container } = render(<TrustBadge />);
    expect(screen.getByLabelText(/does not verify legal identity/)).toHaveTextContent("Liveness checked");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).toHaveAttribute("stroke-width", "1.5");
  });

  it("renders a semantic data row and a wrapping pill without inline colors", () => {
    const { container } = render(<><IconDataRow icon={<BriefcaseBusiness />} title="Engineer" subtitle="Boston">Career summary</IconDataRow><Pill>Photography</Pill></>);
    expect(screen.getByRole("article")).toHaveTextContent("EngineerBostonCareer summary");
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Engineer");
    expect(screen.getByText("Photography")).toBeInTheDocument();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("discloses long prose with an associated control and collapses without moving focus", () => {
    const text = "Thoughtful stories and shared values. ".repeat(30);
    render(<ExpandableProse text={text} label="Personal story" />);
    const more = screen.getByRole("button", { name: "Read more: Personal story" });
    more.focus();
    const prose = document.getElementById(more.getAttribute("aria-controls")!)!;
    expect(prose).toHaveAttribute("data-collapsed", "true");
    fireEvent.click(more);
    expect(prose).toHaveTextContent(text.trim());
    expect(prose).toHaveAttribute("data-collapsed", "false");
    fireEvent.click(more);
    expect(more).toHaveFocus();
    expect(prose).toHaveAttribute("data-collapsed", "true");
  });

  it("does not add an unnecessary disclosure to short prose", () => {
    render(<ExpandableProse text="A short introduction." label="Personal story" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps the vault motif decorative and the optional request action explicit", () => {
    const { container } = render(<ProtectedDataVault showAction />);
    expect(screen.getByRole("link", { name: "Show interest" })).toHaveAttribute("href", "#portfolio-interest");
    expect(container.querySelector('svg[viewBox="0 0 480 480"]')).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector('svg[viewBox="0 0 480 480"]')).toHaveAttribute("focusable", "false");
    expect(screen.getByText("More details shared after approval")).toBeInTheDocument();
  });

  it("keeps mobile chapter links reachable and restores menu focus on Escape", () => {
    render(<PortfolioNav sections={[{ href: "#main-content", label: "Overview" }, { href: "#family", label: "Family" }]} showInterest={false} />);
    const menu = screen.getByRole("button", { name: "Open portfolio sections" });
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "location");
    fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();
  });
});
