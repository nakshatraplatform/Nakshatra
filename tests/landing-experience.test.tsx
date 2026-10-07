// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";

describe("LandingExperience consent-led messaging", () => {
  it("makes controlled disclosure and honest forwarding boundaries clear", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("heading", { name: /one introduction.*one link.*always current/i })).toBeInTheDocument();
    expect(document.querySelector("#top")).toHaveTextContent(/one marriage introduction link instead of another PDF/i);
    expect(document.querySelector("#top")).toHaveTextContent(/free to create/i);
    expect(document.body).toHaveTextContent(/public Introduction can be forwarded or captured/i);
    expect(screen.getByRole("heading", { name: /share the introduction.*decide on the rest/i })).toBeInTheDocument();
    expect(document.querySelector("#privacy")).toHaveTextContent(/a shared link can be forwarded/i);
    expect(document.querySelector("#privacy")).toHaveTextContent(/you decide who gets access/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Not searchable/i);
    expect(screen.getByRole("list", { name: /privacy assurances/i })).toHaveTextContent(/Liveness checks are clearly marked/i);
    expect(document.body).not.toHaveTextContent(/Identity-checked creator|Required before publication/i);
    expect(document.body).toHaveTextContent(/A test publication without this check has no badge/i);
  });

  it("connects every promise to a real route", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getAllByRole("link", { name: /view.*sample introduction/i })[0]).toHaveAttribute("href", "/demo");
    for (const link of screen.getAllByRole("link", { name: /create your portfolio/i })) expect(link).toHaveAttribute("href", "/signup");
    for (const link of screen.getAllByRole("link", { name: /read the viewer guide/i })) expect(link).toHaveAttribute("href", "/received-a-link");
    expect(screen.getByRole("navigation", { name: "Main navigation" })).not.toHaveTextContent(/create your portfolio/i);
    expect(document.querySelector("#beta")).not.toHaveTextContent(/create your portfolio/i);
  });

  it("shows the fictional example before the tour and keeps the viewer path", () => {
    render(<LandingExperience variant="clarity" />);
    const sample = document.querySelector("#samples");
    const tour = document.querySelector("#how");
    const viewer = document.querySelector("#viewer");
    expect(sample).toHaveTextContent(/fictional Introduction/i);
    expect(document.querySelector("#top")).toHaveTextContent(/fictional example of the shared Introduction/i);
    expect(sample).toHaveTextContent(/Complete Portfolio is not shown/i);
    expect(sample?.compareDocumentPosition(tour!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tour?.compareDocumentPosition(viewer!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(viewer?.querySelectorAll("article")).toHaveLength(3);
    expect(viewer?.querySelector('a[href="/received-a-link"]')).toBeInTheDocument();
  });

  it("keeps the guided lifecycle and 15-day approved access distinct", () => {
    render(<LandingExperience variant="clarity" />);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toHaveTextContent(/Create.*Preview and prepare.*Share.*Approve/i);
    expect(screen.getByRole("heading", { name: /how vivintro works/i })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(/create once, share carefully, and decide what comes next/i);
    expect(document.body).toHaveTextContent(/protected access lasts up to 15 days/i);
    expect(document.body).toHaveTextContent(/broker-sponsored actions have no separate VivIntro charge for customers/i);
    expect(document.body).toHaveTextContent(/no paid creator plan yet/i);
    expect(document.body).toHaveTextContent(/unpublish it or rotate the link, which makes the previous link stop working/i);
    expect(document.body).toHaveTextContent(/confirm your email, and begin an unpublished portfolio draft/i);
  });

  it("makes trust and FAQ answers expandable without hiding their questions", () => {
    render(<LandingExperience variant="clarity" />);
    const trust = screen.getByText("Can someone forward the link?").closest("details");
    const faq = screen.getByText("What can someone with my link see?").closest("details");
    expect(trust).not.toHaveAttribute("open");
    expect(faq).not.toHaveAttribute("open");
    fireEvent.click(withinSummary(trust));
    fireEvent.click(withinSummary(faq));
    expect(trust).toHaveAttribute("open");
    expect(faq).toHaveAttribute("open");
    expect(faq).toHaveTextContent("original horoscope file");
  });
});

function withinSummary(details: Element | null) {
  const summary = details?.querySelector("summary");
  if (!summary) throw new Error("Expected an expandable summary");
  return summary;
}
