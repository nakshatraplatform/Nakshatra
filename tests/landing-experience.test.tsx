// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingExperience } from "../src/components/landing/LandingExperience";
import Home from "../src/app/page";
import Faq from "../src/app/faq/page";

describe("landing copy within the established presentation", () => {
  it("names the category once in the hero and distinguishes product from link", () => {
    render(<LandingExperience />);
    const hero = document.querySelector("#top")!;
    expect(hero.querySelector("h1")).toHaveTextContent("Your marriage biodata, shared through one link.");
    expect(hero.textContent?.match(/marriage biodata/gi)).toHaveLength(1);
    expect(hero).toHaveTextContent("VivIntro");
    expect(hero).toHaveTextContent("Vivara is the link you share");
    expect(screen.getAllByRole("link", { name: "Create your introduction" })).toHaveLength(2);
    expect(screen.getByRole("link", { name: "See a sample introduction" })).toHaveAttribute("href", "/demo");
  });

  it("keeps the book, phone chapters and name reveal in their original positions", () => {
    render(<LandingExperience />);
    expect(document.querySelectorAll("#product-story [data-story-chapter]")).toHaveLength(3);
    expect(document.querySelectorAll("#product-story [data-story-shot]")).toHaveLength(3);
    expect(document.querySelectorAll("#how [data-shelf-book]")).toHaveLength(4);
    expect(screen.getByRole("navigation", { name: "Guided tour steps" })).toBeInTheDocument();
    expect(document.querySelector("#vivara [data-vivara-word]")).toHaveTextContent("Vivara");
    expect(document.querySelectorAll("main > section[id]")).toHaveLength(8);
    expect(document.querySelector("#how")).toHaveTextContent(/Family and Astrology are optional/);
    expect(document.querySelector("#how")).toHaveTextContent(/Private details stay separate/);
    expect(screen.getByRole("link", { name: /Share your experience/ })).toHaveAttribute("href", "/share-feedback");
  });

  it("keeps consent, privacy and saved-copy limits explicit", () => {
    render(<LandingExperience />);
    const privacy = document.querySelector("#privacy")!;
    expect(privacy).toHaveTextContent(/viewer signs in and confirms their email/i);
    expect(privacy).toHaveTextContent(/up to 15 days/i);
    expect(privacy).toHaveTextContent(/copies already saved can.t be recalled/i);
    expect(privacy).toHaveTextContent(/Your notes and street address aren.t included in either shared view/i);
    expect(document.querySelector("#top")).not.toHaveTextContent(/private link/i);
    const expiry = screen.getByText("What happens after I share details?").closest("details");
    expect(expiry).toHaveTextContent(/Unpublishing pauses viewing/i);
    expect(expiry).toHaveTextContent(/replacing the link ends that sharing/i);
    const liveness = screen.getByText("What does “Liveness checked” mean?").closest("details");
    expect(liveness).toHaveTextContent(/does not verify legal identity/i);
  });

  it("keeps questions accessible and the home FAQ identical to structured data", () => {
    const { container } = render(<Home />);
    const questions = [...container.querySelectorAll("#questions details")];
    expect(questions).toHaveLength(6);
    const faq = questions[0];
    fireEvent.click(faq.querySelector("summary")!);
    expect(faq).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Read all questions" })).toHaveAttribute("href", "/faq");
    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"];
    const schemaFaq = graph.find((item: { "@type": string }) => item["@type"] === "FAQPage");
    expect(schemaFaq.mainEntity.map((item: { name: string }) => item.name))
      .toEqual(questions.map(item => item.querySelector("summary")!.textContent));
    expect(container.querySelectorAll("h1")).toHaveLength(1);
  });

  it("retains the ten detailed FAQ answers separately", () => {
    render(<Faq />);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    expect(document.body).toHaveTextContent(/Creating and sharing is free/i);
    expect(document.body).toHaveTextContent(/no profile directory or match suggestions/i);
  });
});
