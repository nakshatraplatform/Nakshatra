import { describe, expect, it } from "vitest";
import inventory from "../design/brokerdesk/endpoint-inventory.v1.json";
import { brokerdeskEndpointInventorySchema } from "@/features/security/brokerdesk-endpoint-inventory";

describe("BrokerDesk endpoint inventory", () => {
  it("keeps every planned contract machine-readable and unique", () => {
    const parsed = brokerdeskEndpointInventorySchema.parse(inventory);
    expect(parsed.endpoints).toHaveLength(35);
    expect(parsed.endpoints.find(endpoint => endpoint.path === "/api/v1/family/introductions")).toMatchObject({
      status: "active", method: "GET", audience: "family_viewer", authentication: "live_session",
      inputSchema: "familyDashboardQuerySchema", outputSchema: "familyDashboardSchema",
    });
  });

  it("rejects duplicate route contracts", () => {
    const duplicate = {
      ...inventory,
      endpoints: [...inventory.endpoints, inventory.endpoints[0]],
    };
    expect(brokerdeskEndpointInventorySchema.safeParse(duplicate).success).toBe(false);
  });

  it("rejects undeclared fields that could bypass review", () => {
    const unsafe = {
      ...inventory,
      endpoints: [{ ...inventory.endpoints[0], organizationId: "client-controlled" }],
    };
    expect(brokerdeskEndpointInventorySchema.safeParse(unsafe).success).toBe(false);
  });

  it("names the implemented family-viewer transport contracts", () => {
    const byId = new Map(inventory.endpoints.map((endpoint) => [endpoint.id, endpoint]));
    expect(byId.get("brokerdesk.customer.family.viewers.create")?.outputSchema)
      .toBe("candidateFamilyViewerCreateResponseSchema");
    expect(byId.get("brokerdesk.customer.family.viewers.decide")?.outputSchema)
      .toBe("candidateFamilyViewerDecisionResponseSchema");
    expect(byId.get("brokerdesk.family.invitation.exchange")).toMatchObject({
      inputSchema: "familyInvitationExchangeRequestSchema",
      outputSchema: "familyInvitationExchangeResponseSchema",
    });
  });
});
