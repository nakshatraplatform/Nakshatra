import { themeTestCookie, themeTestUser } from "./theme-session.mjs";
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
export const recoveryTestToken = [encode({ alg: "HS256", typ: "JWT" }), encode({ sub: themeTestUser.id, role: "authenticated", exp: 4102444800, session_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", fixture: "candidate-recovery" }), encode("loopback-only-not-a-real-signature")].join(".");
export const recoveryTestCookie = { ...themeTestCookie, value: `base64-${encode({ access_token: recoveryTestToken, refresh_token: "loopback-only-recovery", expires_at: 4102444800, token_type: "bearer", user: themeTestUser })}` };
