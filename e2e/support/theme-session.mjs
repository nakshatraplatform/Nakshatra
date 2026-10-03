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

// Separate owner fixture so responsive dashboard tests do not change theme-test state.
export const dashboardTestUser = { ...themeTestUser, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", email: "dashboard-test@example.test" };
export const dashboardTestToken = [
  encode({ alg: "HS256", typ: "JWT" }),
  encode({ sub: dashboardTestUser.id, role: dashboardTestUser.role, exp: 4102444800, session_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }),
  Buffer.from("not-a-signature-local-dashboard-fixture").toString("base64url"),
].join(".");
export const dashboardTestCookie = {
  ...themeTestCookie,
  value: `base64-${encode({ access_token: dashboardTestToken, refresh_token: "local-dashboard-fixture", expires_at: 4102444800, expires_in: 3600, token_type: "bearer", user: dashboardTestUser })}`,
};
