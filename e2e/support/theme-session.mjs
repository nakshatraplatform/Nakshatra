// Synthetic session accepted ONLY by the loopback mock server, never Supabase.
export const themeTestUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  aud: "authenticated",
  role: "authenticated",
  email: "theme-test@example.test",
};
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
export const themeTestToken = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: themeTestUser.id, role: themeTestUser.role, exp: 4102444800, session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }),
  Buffer.from("not-a-signature-local-ui-fixture").toString("base64url"),
].join(".");

export const themeTestCookie = {
  name: "sb-127-auth-token",
  value: `base64-${encode({ access_token: themeTestToken, refresh_token: "local-ui-fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: themeTestUser })}`,
  domain: "127.0.0.1",
  path: "/",
};

// Local browser fixture for the recipient of an approved personal-link grant.
// The loopback mock alone accepts this synthetic token; it cannot authenticate to Production.
export const approvedViewerUser = {
  ...themeTestUser,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "approved-viewer@example.test",
  email_confirmed_at: "2026-10-01T00:00:00Z",
};
export const approvedViewerToken = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: approvedViewerUser.id, role: approvedViewerUser.role, exp: 4102444800, session_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
  Buffer.from("not-a-signature-approved-local-fixture").toString("base64url"),
].join(".");
export const approvedViewerCookie = {
  ...themeTestCookie,
  value: `base64-${encode({ access_token: approvedViewerToken, refresh_token: "approved-local-ui-fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: approvedViewerUser })}`,
};

// Published creator fixture: accepted only by the local loopback mock.
export const publishedOwnerUser = {
  ...themeTestUser,
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  email: "published-owner@example.test",
  email_confirmed_at: "2026-10-01T00:00:00Z",
};
export const publishedOwnerToken = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: publishedOwnerUser.id, role: publishedOwnerUser.role, exp: 4102444800, session_id: "ffffffff-ffff-4fff-8fff-ffffffffffff" }),
  Buffer.from("not-a-signature-published-local-fixture").toString("base64url"),
].join(".");
export const publishedOwnerCookie = {
  ...themeTestCookie,
  value: `base64-${encode({ access_token: publishedOwnerToken, refresh_token: "published-local-ui-fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: publishedOwnerUser })}`,
};

// Unpublished owner: synthetic token accepted only by the local mock.
export const draftOwnerUser = { ...publishedOwnerUser, id: "99999999-9999-4999-8999-999999999999", email: "draft-owner@example.test" };
export const draftOwnerToken = [encode({ alg: "HS256", typ: "JWT" }), encode({ sub: draftOwnerUser.id, role: "authenticated", exp: 4102444800, session_id: "77777777-7777-4777-8777-777777777777" }), Buffer.from("draft-local-ui-fixture").toString("base64url")].join(".");
export const draftOwnerCookie = { ...themeTestCookie, value: `base64-${encode({ access_token: draftOwnerToken, refresh_token: "draft-local-ui-fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: draftOwnerUser })}` };
