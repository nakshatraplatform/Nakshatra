// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CelestialUnion from "../src/components/templates/CelestialUnion";
import { createApprovedPortfolioSnapshot } from "../src/features/portfolio/server/approved-snapshot.service";
import { createPublicPortfolioSnapshot } from "../src/features/portfolio/server/public-snapshot.service";
import { representativePortfolio } from "./fixtures/portfolio-view-fixtures";

describe("representative portfolio views", () => {
  it("keeps Short View concise and excludes protected identity and contact details", () => {
    const data = createPublicPortfolioSnapshot({ ...representativePortfolio, privacy_mode: "private" });
    const { container } = render(<CelestialUnion data={data} themeColor="" sunSign="mesha" accessMode="public" />);

    expect(container.querySelector(".portfolio-short-overview")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ananya" })).toBeInTheDocument();
    expect(screen.queryByText("Ananya Mehta")).not.toBeInTheDocument();
    expect(screen.queryByText("1995-04-18")).not.toBeInTheDocument();
    expect(screen.queryByText("Example Company")).not.toBeInTheDocument();
    expect(screen.queryByText("Never married")).not.toBeInTheDocument();
    expect(screen.queryByText("Hindu")).not.toBeInTheDocument();
    expect(screen.queryByText("Gujarati")).not.toBeInTheDocument();
    expect(screen.queryByText("family@example.test")).not.toBeInTheDocument();
  });

  it("uses the chaptered Standard View while keeping protected details out", () => {
    const data = createPublicPortfolioSnapshot(representativePortfolio);
    const { container } = render(<CelestialUnion data={data} themeColor="" sunSign="mesha" accessMode="public" />);

    expect(container.querySelector(".portfolio-short-overview")).toBeNull();
    expect(screen.getByRole("heading", { name: "Ananya Mehta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal story" })).toBeInTheDocument();
    expect(screen.queryByText("1995-04-18")).not.toBeInTheDocument();
    expect(screen.queryByText("$100k–$125k")).not.toBeInTheDocument();
    expect(screen.queryByText("Fictional Mother")).not.toBeInTheDocument();
    expect(screen.queryByText("family@example.test")).not.toBeInTheDocument();
  });

  it("shows decision details in Full View but still excludes owner-only data", () => {
    const data = createApprovedPortfolioSnapshot(representativePortfolio);
    render(<CelestialUnion data={data} themeColor="" sunSign="mesha" accessMode="approved" accessExpiresAt="2030-01-02T15:30:00.000Z" />);

    expect(screen.getByText("1995-04-18")).toBeInTheDocument();
    expect(screen.getByText("$100k–$125k · USD")).toBeInTheDocument();
    expect(screen.getByText("Fictional Mother · Teacher")).toBeInTheDocument();
    expect(screen.getByText("family@example.test")).toBeInTheDocument();
    expect(data).not.toHaveProperty("access");
    expect(data).not.toHaveProperty("visibility");
  });
});
