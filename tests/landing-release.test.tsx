// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";

describe("landing content and motion contract", () => {
  it("uses one category phrase in the hero without changing the established story", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Your marriage biodata, shared through one link.");
    expect(screen.getByText("A simple way to introduce yourself")).toBeInTheDocument();
    expect(document.querySelector("#top")!.textContent?.match(/marriage biodata/gi)).toHaveLength(1);
    expect(document.querySelectorAll("#product-story [data-story-chapter]")).toHaveLength(3);
    expect(document.querySelectorAll("#how [data-shelf-book]")).toHaveLength(4);
    expect(document.querySelector("#vivara")).toBeInTheDocument();
  });

  it("keeps public metadata and six visible FAQs aligned", () => {
    const { container } = render(<Home />);
    const questions = [...container.querySelectorAll("#questions details")];
    expect(questions).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Read all questions" })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("link", { name: "Read the marriage biodata guide" })).toHaveAttribute("href", "/guides/marriage-biodata-format");
    const graph = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!)["@graph"];
    expect(graph.find((item: { "@type": string }) => item["@type"] === "WebApplication").name).toBe("VivIntro");
    const faq = graph.find((item: { "@type": string }) => item["@type"] === "FAQPage");
    expect(faq.mainEntity.map((item: { name: string }) => item.name))
      .toEqual(questions.map(item => item.querySelector("summary")!.textContent));
  });
});
