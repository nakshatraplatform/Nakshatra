// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const refresh = vi.hoisted(() => vi.fn());
const manageConsent = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/broker-relationships/client/customer-invitation.api", () => ({
  manageCustomerBrokerConsent: manageConsent,
}));

import { CustomerBrokerCard } from "../src/app/brokers/customer-broker-card";
import { customerBrokerRelationshipsSchema } from "@/features/broker-relationships/server/customer-invitation.contract";

const relationship = customerBrokerRelationshipsSchema.parse({ available: true, relationships: [{
  relationshipRef: `bcr_${"a".repeat(32)}`,
  workspaceName: "Agency A",
  relationshipStatus: "active" as const,
  startsAt: "2026-09-10T00:00:00Z",
  endsAt: "2027-09-10T00:00:00Z",
  actions: { canPause: true, canRenew: false, canTerminate: true },
}] }).relationships[0];

describe("customer broker consent controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manageConsent.mockResolvedValue({ available: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("explains active access, confirms a pause, and refreshes only after success", async () => {
    render(<CustomerBrokerCard relationship={relationship} />);
    expect(screen.getByText(/published Broker Standard Profile/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause broker access" }));
    await waitFor(() => expect(manageConsent).toHaveBeenCalledWith(
      relationship.relationshipRef, "pause", expect.any(String)
    ));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("old links will stay closed"));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("shows a failure and does not refresh when the server rejects the change", async () => {
    manageConsent.mockRejectedValueOnce(new Error("The broker access change could not be saved."));
    render(<CustomerBrokerCard relationship={relationship} />);
    fireEvent.click(screen.getByRole("button", { name: "End broker relationship" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be saved");
    expect(refresh).not.toHaveBeenCalled();
  });
});
