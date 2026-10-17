// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";
import Home from "../src/app/page";

describe("LandingExperience consent-led messaging", () => {
  it("makes controlled disclosure and honest forwarding boundaries clear", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("heading", { name: "Your biodata, as one link you control." })).toBeInTheDocument();
    expect(document.querySelector("#top")).toHaveTextContent(/without sending a new PDF/i);
    expect(document.querySelector("#top")).toHaveTextContent(/Free. Private until you publish./i);
    expect(document.body).toHaveTextContent(/first view can be forwarded or screenshotted/i);
    expect(screen.getByRole("heading", { name: "You decide who sees what." })).toBeInTheDocument();
    expect(document.querySelector("#privacy")).toHaveTextContent(/anything someone can see, they can screenshot/i);
    expect(document.body).toHaveTextContent(/copies someone has already saved cannot be erased/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Not listed in any directory/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).not.toHaveTextContent(/Liveness|not searchable/i);
    expect(document.body).not.toHaveTextContent(/Identity-checked creator|Required before publication/i);
    expect(document.body).toHaveTextContent(/A test publication without this check has no badge/i);
  });

  it("connects every promise to a real route", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getAllByRole("link", { name: "See an example" })[0]).toHaveAttribute("href", "/demo");
    for (const link of screen.getAllByRole("link", { name: "Create your introduction" })) expect(link).toHaveAttribute("href", "/signup");
    for (const link of screen.getAllByRole("link", { name: /read the viewer guide/i })) expect(link).toHaveAttribute("href", "/received-a-link");
    expect(screen.getByRole("navigation", { name: "Main navigation" })).not.toHaveTextContent(/create your portfolio/i);
    expect(document.querySelector("#beta")).not.toHaveTextContent(/create your portfolio/i);
  });

  it("shows the fictional example before the tour and keeps the viewer path", () => {
    render(<LandingExperience variant="clarity" />);
    const sample = document.querySelector("#samples");
    const tour = document.querySelector("#how");
    const viewer = document.querySelector("#viewer");
    expect(sample).toHaveTextContent(/fictional/i);
    expect(document.querySelector("#top")).toHaveTextContent(/fictional example of the shared Introduction/i);
    expect(sample).toHaveTextContent(/Private details are not shown/i);
    expect(sample?.compareDocumentPosition(tour!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tour?.compareDocumentPosition(viewer!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(viewer?.querySelectorAll("article")).toHaveLength(3);
    expect(viewer?.querySelector('a[href="/received-a-link"]')).toBeInTheDocument();
  });

  it("keeps the guided lifecycle and 15-day shared details distinct", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Review and consent.*Share.*Share details/i);
    expect(screen.getByRole("heading", { name: /how vivintro works/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/previews are optional/i);
    expect(document.body).toHaveTextContent(/Creating and sharing is free/i);
    expect(document.body).not.toHaveTextContent(/broker-sponsored/i);
    const controls = screen.getByText("What happens after I share details?").closest("details");
    expect(controls).toHaveTextContent(/unpublishing pauses viewing/i);
    expect(controls).toHaveTextContent(/hasn’t ended or been stopped can resume/i);
    expect(controls).toHaveTextContent(/end access early or renew it/i);
    const family = screen.getByText("Can a parent or sibling create my profile?").closest("details");
    expect(family).toHaveTextContent(/family member to create a profile on your behalf is coming soon/i);
    expect(family).toHaveTextContent(/For now, create and publish your own introduction/i);
  });

  it("makes trust and FAQ answers expandable without hiding their questions", () => {
    render(<LandingExperience variant="clarity" />);
    const trust = screen.getByText("Choose your first view").closest("details");
    const faq = screen.getByText("Can my link be forwarded?").closest("details");
    expect(trust).not.toHaveAttribute("open");
    expect(faq).not.toHaveAttribute("open");
    fireEvent.click(withinSummary(trust));
    fireEvent.click(withinSummary(faq));
    expect(trust).toHaveAttribute("open");
    expect(faq).toHaveAttribute("open");
    expect(faq).toHaveTextContent("You choose who sees your private details");
  });

  it("keeps the audience boundaries and current liveness limits explicit", () => {
    render(<LandingExperience />);
const publicView = screen.getByRole("heading", { name: "Your introduction" }).closest("article");
    const completeView = screen.getByRole("heading", { name: "Private details" }).closest("article");
    const ownerView = screen.getByRole("heading", { name: "Private notes" }).closest("article");
    expect(publicView).toHaveTextContent(/anyone with your link/i);
    expect(completeView).toHaveTextContent(/when you choose to share/i);
    expect(completeView).toHaveTextContent(/confirms their email/i);
    expect(ownerView).toHaveTextContent(/aren’t included in either shared view/i);
    expect(document.querySelector("#privacy")).toHaveTextContent(/keep phone numbers and other private details out of your public story/i);
    const liveness = screen.getByText("What does “Liveness checked” mean?").closest("details");
    expect(liveness).toHaveTextContent(/doesn’t verify legal identity, compare photos/i);
  });

  it("serves the same FAQ answers to readers and structured-data consumers", () => {
    const { container } = render(<Home />);
    const schema = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    const faq = schema["@graph"].find((entry: { "@type": string }) => entry["@type"] === "FAQPage");
    const rendered = [...container.querySelectorAll("#questions details")].map((entry) => ({
      question: entry.querySelector("summary")!.textContent,
      answer: entry.querySelector("p")!.textContent,
    }));
    expect(rendered).toHaveLength(7);
    expect(faq.mainEntity.map((entry: { name: string; acceptedAnswer: { text: string } }) => ({
      question: entry.name,
      answer: entry.acceptedAnswer.text,
    }))).toEqual(rendered);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });
});

function withinSummary(details: Element | null) {
  const summary = details?.querySelector("summary");
  if (!summary) throw new Error("Expected an expandable summary");
  return summary;
}
