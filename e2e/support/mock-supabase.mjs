import { createServer } from "node:http";
import { approvedViewerToken, approvedViewerUser, publishedOwnerToken, publishedOwnerUser, draftOwnerToken, draftOwnerUser, themeTestToken, themeTestUser } from "./theme-session.mjs";
import { recoveryTestToken } from "./recovery-session.mjs";

const host = "127.0.0.1";
const port = 54329;
const portfolioId = "11111111-1111-4111-8111-111111111111";
const authenticatedAccessToken = "e2e-authenticated-user-token";
const authenticatedUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  role: "authenticated",
  email: "authenticated@example.test",
};

const publicSnapshot = {
  data: {
    privacy_mode: "balanced",
    personal: {
      name: "Aditi Rao",
      preferred_name: "Aditi",
      age: 29,
      gender: "female",
      current_location: "Boston",
      short_bio: "Warm, grounded, and curious about the world.",
      profile_summary: "A thoughtful introduction",
      shared_life_plans: "A warm home, shared purpose, and room to grow together.",
    },
    vitals: { height: "5 ft 5 in", complexion: "Fair" },
    astrology: { rashi: "kanya", nakshatra: "Uttara Phalguni", pada: "2" },
    education: { degree: "MS", institution: "Northeastern", year: "2020" },
    career: { title: "Engineer", company: "Nakshatra", location: "Boston" },
    lifestyle: { hobbies: "Reading, Travel", diet: "Vegetarian" },
    preferences: { narrative: "A kind and curious partnership" },
    style: {
      appearance: "light",
      template_name: "Celestial Union",
      theme_color: "#f2c6a7",
      rashi_palette: "kanya-peach",
    },
    visibility: {
      family: "restricted",
      family_details: "restricted",
      astrology: "public",
      astrology_details: "restricted",
      contact: "restricted",
    },
  },
};

const ownerPortfolio = {
  id: portfolioId,
  user_id: publishedOwnerUser.id,
  candidate_id: null,
  share_token: "e2e-portfolio-token",
  draft_data: {
    ...publicSnapshot.data,
    personal: { ...publicSnapshot.data.personal, name: "Aditi Rao", first_name: "Aditi", last_name: "Rao", profile_for: "self", dob: "1997-02-12", country: "United States", city: "Boston", current_location: "Boston, United States", marital_status: "Never Married", profile_summary: undefined, shared_life_plans: undefined },
    vitals: { height: "5'5\"" },
    contact: { contact_person: "Aditi Rao", phone: "+1 555 010 0200", email: "aditi@example.test" },
  },
  published_data: {
    ...publicSnapshot.data,
    personal: { ...publicSnapshot.data.personal, profile_for: "self", dob: "1997-02-12" },
  },
  template_id: 3,
  theme_color: "#f2c6a7",
  sun_sign: "kanya",
  is_published: true,
  published_at: "2026-10-01T00:00:00Z",
  expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  last_renewed_at: null,
  privacy_mode: "balanced",
  visibility_settings: {},
  created_at: "2026-09-15T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const ownerInterests = [
  { id: "12121212-1212-4212-8212-121212121212", viewer_name: "Maya Shah", viewer_phone: null, viewer_email: "maya@example.test", viewer_family_context: "Our families have spoken once.", message: "We would like to learn more.", status: "pending_review", requester_user_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", metadata: { profile_for: "self" }, created_at: "2026-10-03T12:00:00Z", email_verified: true, source_type: "direct", broker_name: null, broker_representative_name: null, requester_portfolio_token: null },
  { id: "34343434-3434-4434-8434-343434343434", viewer_name: "A long family name for layout testing that should wrap without hiding the decision", viewer_phone: null, viewer_email: "family@example.test", viewer_family_context: null, message: "Would it be possible to talk first?", status: "new", requester_user_id: "abababab-abab-4bab-8bab-abababababab", metadata: { profile_for: "family" }, created_at: "2026-10-02T12:00:00Z", email_verified: false, source_type: "direct", broker_name: null, broker_representative_name: null, requester_portfolio_token: null },
  { id: "56565656-5656-4656-8656-565656565656", viewer_name: "Samira", viewer_phone: null, viewer_email: "samira@example.test", viewer_family_context: null, message: null, status: "rejected", requester_user_id: null, metadata: {}, created_at: "2026-09-27T12:00:00Z", email_verified: true, source_type: "direct", broker_name: null, broker_representative_name: null, requester_portfolio_token: null },
];

const ownerAccess = {
  grants: [
    { id: "78787878-7878-4878-8878-787878787878", interestRequestId: "90909090-9090-4090-8090-909090909090", viewerName: "Rohan", viewerEmail: "rohan@example.test", sourceType: "direct", brokerName: null, status: "active", expiresAt: new Date(Date.now() + 2 * 86_400_000).toISOString(), renewedAt: null, revokedAt: null, lastAccessedAt: "2026-10-04T10:00:00Z" },
    { id: "89898989-8989-4898-8898-898989898989", interestRequestId: "91919191-9191-4191-8191-919191919191", viewerName: "Priya", viewerEmail: "priya@example.test", sourceType: "direct", brokerName: null, status: "expired", expiresAt: "2026-09-20T00:00:00Z", renewedAt: null, revokedAt: null, lastAccessedAt: null },
  ],
  events: [{ id: 1, eventType: "grant_created", viewerName: "Rohan", createdAt: "2026-10-01T12:00:00Z", metadata: {} }],
};

const publicMedia = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/portrait.svg`,
    thumbnail_path: null,
    media_type: "hero",
    visibility: "public",
    sort_order: 0,
    alt_text: "Public portrait",
    metadata: { width: 900, height: 1200, aspectRatio: 0.75, orientation: "portrait" },
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/landscape.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 1,
    alt_text: "Public landscape",
    metadata: { width: 1600, height: 900, aspectRatio: 16 / 9, orientation: "landscape" },
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/protected-original.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "approved_only",
    sort_order: 2,
    alt_text: "Protected portrait",
    metadata: {
      width: 900,
      height: 1200,
      aspectRatio: 0.75,
      orientation: "portrait",
      blurPath: `${portfolioId}/protected-blur.svg`,
    },
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/square-one.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 3,
    alt_text: "Public square moment",
    metadata: { width: 1000, height: 1000, aspectRatio: 1, orientation: "square" },
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/portrait-two.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 4,
    alt_text: "Public portrait moment",
    metadata: { width: 900, height: 1200, aspectRatio: 0.75, orientation: "portrait" },
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/landscape-two.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 5,
    alt_text: "Second public landscape",
    metadata: { width: 1600, height: 900, aspectRatio: 16 / 9, orientation: "landscape" },
  },
  {
    id: "88888888-8888-4888-8888-888888888888",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/square-two.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 6,
    alt_text: "Second public square moment",
    metadata: { width: 1000, height: 1000, aspectRatio: 1, orientation: "square" },
  },
  {
    id: "99999999-9999-4999-8999-999999999999",
    portfolio_id: portfolioId,
    storage_path: `${portfolioId}/portrait-three.svg`,
    thumbnail_path: null,
    media_type: "gallery",
    visibility: "public",
    sort_order: 7,
    alt_text: "Third public portrait moment",
    metadata: { width: 900, height: 1200, aspectRatio: 0.75, orientation: "portrait" },
  },
];

const publicMediaWithPreviews = publicMedia.map((item) =>
  item.media_type === "gallery" && !item.metadata?.blurPath
    ? {
        ...item,
        metadata: {
          ...item.metadata,
          blurPath: item.storage_path.replace(/\.svg$/, "-blur.svg"),
        },
      }
    : item
);

function resolvedPortfolio(isPrivate) {
  let clearGallerySeen = false;
  const media = publicMediaWithPreviews.map((item) => {
    const protectedPhoto = item.visibility !== "public";
    const privateGallery = isPrivate && item.media_type === "gallery";
    const clearPrivateGallery = privateGallery && !protectedPhoto && !clearGallerySeen;
    if (clearPrivateGallery) clearGallerySeen = true;
    const blurred = protectedPhoto || (privateGallery && !clearPrivateGallery);
    return {
      key: `safe-${item.sort_order}`,
      accessPath: blurred ? item.metadata.blurPath : item.storage_path,
      altText: item.alt_text,
      mediaType: item.media_type,
      sortOrder: item.sort_order,
      width: item.metadata.width,
      height: item.metadata.height,
      aspectRatio: item.metadata.aspectRatio,
      orientation: item.metadata.orientation,
      presentation: blurred ? "blurred" : "clear",
    };
  });
  return {
    data: { ...publicSnapshot.data, privacy_mode: isPrivate ? "private" : "balanced" },
    templateId: 3,
    themeColor: "#f2c6a7",
    sunSign: "kanya",
    media,
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify(value));
}

function sendPortfolioImage(response, path) {
  const landscape = path.includes("landscape");
  const square = path.includes("square");
  const width = landscape ? 1600 : square ? 1000 : 900;
  const height = landscape ? 900 : square ? 1000 : 1200;
  const label = path.includes("protected") ? "PROTECTED PREVIEW" : landscape ? "PUBLIC GALLERY" : "PUBLIC PORTRAIT";
  response.writeHead(200, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "image/svg+xml",
  });
  response.end(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#3f3150"/><circle cx="50%" cy="42%" r="22%" fill="#f2c6a7"/><text x="50%" y="82%" fill="#fffdf8" font-family="sans-serif" font-size="64" text-anchor="middle">${label}</text></svg>`
  );
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Origin": "*",
    });
    return response.end();
  }

  if (url.pathname === "/health") return sendJson(response, 200, { ok: true });
  if (url.pathname === "/auth/v1/user") {
    if ([themeTestToken, recoveryTestToken].some(token => request.headers.authorization === `Bearer ${token}`)) return sendJson(response, 200, themeTestUser);
    if (request.headers.authorization === `Bearer ${approvedViewerToken}`) return sendJson(response, 200, approvedViewerUser);
    if (request.headers.authorization === `Bearer ${publishedOwnerToken}`) return sendJson(response, 200, publishedOwnerUser);
    if (request.headers.authorization === `Bearer ${draftOwnerToken}`) return sendJson(response, 200, draftOwnerUser);
    if (request.headers.authorization === `Bearer ${authenticatedAccessToken}`) {
      return sendJson(response, 200, authenticatedUser);
    }
    return sendJson(response, 401, { message: "Unauthorized" });
  }
  if (request.method === "POST" && url.pathname === "/auth/v1/otp") {
    return sendJson(response, 200, {});
  }
  // Theme browser coverage uses the real page components with loopback-only,
  // read-only projections. Production authorization code is never replaced.
  if ([themeTestToken, recoveryTestToken].some(token => request.headers.authorization === `Bearer ${token}`)) {
    // These older fixtures exercise additive-migration compatibility: editing
    // remains available, but separately loaded review evidence is not trusted.
    if (url.pathname === "/rest/v1/rpc/get_owner_dashboard_review_snapshot") return sendJson(response, 404, { code: "PGRST202", message: "Fixture RPC unavailable" });
    if (request.headers.authorization === `Bearer ${recoveryTestToken}` && url.pathname === "/rest/v1/portfolios") return sendJson(response, 200, {
      id: portfolioId, candidate_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", user_id: themeTestUser.id,
      draft_data: { personal: { profile_for: "self" } }, published_data: null, is_published: false,
      privacy_mode: "balanced", visibility_settings: {}, created_at: "2026-10-06T00:00:00Z", updated_at: "2026-10-06T00:00:00Z",
    });
    if (["/rest/v1/rpc/is_current_session_active", "/rest/v1/rpc/current_user_can_create_portfolio"].includes(url.pathname)) return sendJson(response, 200, true);
    if (url.pathname === "/rest/v1/rpc/resolve_customer_broker_relationships") return sendJson(response, 200, { available: true, relationships: [] });
    if (url.pathname === "/rest/v1/rpc/resolve_brokerdesk_bootstrap") return sendJson(response, 200, { workspaces: [], nextAction: "create_workspace" });
    if (url.pathname === "/rest/v1/rpc/resolve_brokerdesk_team") return sendJson(response, 200, {
      available: true,
      workspaceRef: `wrk_${"e".repeat(32)}`,
      members: [{
        memberRef: `mbr_${"f".repeat(32)}`,
        displayName: "Agency Owner",
        email: "owner@example.test",
        rolePreset: "owner",
        status: "active",
        customerAccess: "all_customers",
        assignedCustomerCount: 0,
        joinedAt: "2026-09-09T00:00:00Z",
        isCurrentUser: true,
      }],
    });
    if (["/rest/v1/portfolios", "/rest/v1/account_deletion_requests"].includes(url.pathname)) return sendJson(response, 200, null);
  }
  if ([publishedOwnerToken, draftOwnerToken].some(token => request.headers.authorization === `Bearer ${token}`)) {
    const draftOwner = request.headers.authorization === `Bearer ${draftOwnerToken}`;
    const dashboardPortfolio = draftOwner ? {
      ...ownerPortfolio, user_id: draftOwnerUser.id, candidate_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", is_published: false,
      published_data: null, published_at: null, share_token: null, expires_at: null,
    } : ownerPortfolio;
    const readiness = { portfolioExists: true, lastEditorSection: "foundation", previewedAt: "2026-09-30T00:00:00Z", reviewFingerprint: "a".repeat(64), publicPreviewReviewed: true, completePreviewReviewed: true, selectedPlanCode: "launch_30", verificationStatus: draftOwner ? "required" : "test_exempt", paymentStatus: "paid", paymentExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(), paymentActive: true, disclosureConfirmed: !draftOwner, published: !draftOwner, missingRequired: [] };
    if (url.pathname === "/rest/v1/rpc/get_owner_dashboard_review_snapshot") return sendJson(response, 200, { portfolio: dashboardPortfolio, media: [publicMedia[0]], horoscope: null, readiness });
    if (["/rest/v1/rpc/is_current_session_active", "/rest/v1/rpc/current_user_can_create_portfolio"].includes(url.pathname)) return sendJson(response, 200, true);
    if (url.pathname === "/rest/v1/portfolios") return sendJson(response, 200, dashboardPortfolio);
    if (url.pathname === "/rest/v1/portfolio_views") {
      response.writeHead(200, { "Content-Range": "0-11/12", "Access-Control-Allow-Origin": "*" });
      return response.end();
    }
    if (url.pathname === "/rest/v1/portfolio_media") return sendJson(response, 200, [publicMedia[0]]);
    if (url.pathname === "/rest/v1/portfolio_horoscopes") return sendJson(response, 200, null);
    if (url.pathname === "/rest/v1/rpc/list_dashboard_interests") return sendJson(response, 200, ownerInterests);
    if (url.pathname === "/rest/v1/rpc/list_portfolio_access") return sendJson(response, 200, ownerAccess);
    if (url.pathname === "/rest/v1/rpc/get_portfolio_publication_readiness") return sendJson(response, 200, readiness);
  }
  if (url.pathname === "/rest/v1/public_portfolio_snapshots" || url.pathname === "/rest/v1/portfolio_media") {
    return sendJson(response, 403, { message: "Direct public table access is disabled" });
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/resolve_public_portfolio") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    return request.on("end", () => {
      const token = JSON.parse(body || "{}").p_share_token;
      if (!["e2e-portfolio-token", "e2e-private-token", "e2e-dark-portfolio-token"].includes(token)) return sendJson(response, 200, null);
      const portfolio = structuredClone(resolvedPortfolio(token === "e2e-private-token"));
      if (token === "e2e-dark-portfolio-token") portfolio.data.style.appearance = "dark";
      return sendJson(response, 200, portfolio);
    });
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/resolve_public_portfolio_identity_verified") {
    return sendJson(response, 200, true);
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/resolve_public_portfolio_status") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    return request.on("end", () => sendJson(response, 200, JSON.parse(body || "{}").p_share_token === "e2e-expired-token" ? "expired" : "unavailable"));
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/resolve_complete_portfolio_access") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    return request.on("end", () => {
      if (request.headers.authorization !== `Bearer ${approvedViewerToken}`) return sendJson(response, 200, { status: "signin_required" });
      const grantId = JSON.parse(body || "{}").p_grant_id;
      if (grantId === "11111111-1111-4111-8111-111111111111") return sendJson(response, 200, { status: "active", shareToken: "e2e-portfolio-token", expiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
      if (grantId === "22222222-2222-4222-8222-222222222222") return sendJson(response, 200, { status: "expired" });
      if (grantId === "33333333-3333-4333-8333-333333333333") return sendJson(response, 200, { status: "revoked" });
      return sendJson(response, 200, { status: "unavailable" });
    });
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/resolve_approved_portfolio") {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    return request.on("end", () => {
      if (request.headers.authorization !== `Bearer ${approvedViewerToken}` || JSON.parse(body || "{}").p_share_token !== "e2e-portfolio-token") return sendJson(response, 200, null);
      return sendJson(response, 200, {
        ...resolvedPortfolio(false),
        data: {
          ...publicSnapshot.data,
          contact: { contact_person: "Aditi Rao", phone: "+1 555 010 0200", email: "aditi@example.test" },
        },
        media: resolvedPortfolio(false).media.map((item) => ({
          ...item,
          accessPath: publicMediaWithPreviews[item.sortOrder].storage_path,
          presentation: "clear",
        })),
        accessExpiresAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      });
    });
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/record_public_portfolio_view") {
    return sendJson(response, 200, true);
  }
  if (request.method === "POST" && url.pathname === "/rest/v1/rpc/consume_api_rate_limit") {
    return sendJson(response, 200, { allowed: true, retryAfter: 0 });
  }
  if (request.method === "POST" && url.pathname.startsWith("/storage/v1/object/sign/photos/")) {
    return sendJson(response, 200, {
      signedURL: `${url.pathname.replace("/storage/v1", "")}?token=e2e`,
    });
  }
  if (request.method === "GET" && url.pathname.startsWith("/storage/v1/object/sign/photos/")) {
    return sendPortfolioImage(response, url.pathname);
  }

  return sendJson(response, 404, { message: "Not found" });
});

server.listen(port, host);

function closeServer() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", closeServer);
process.on("SIGTERM", closeServer);
