const encoder = new TextEncoder();
const SESSION_COOKIE_NAME = "nav_session";
const DEFAULT_SESSION_SECONDS = 60 * 60 * 8;
const REMEMBER_SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function verifyPassword(input, env) {
  const password = String(input || "");

  if (env.NAV_PASSWORD_HASH) {
    const hashedInput = await sha256Hex(password);
    return safeEqual(hashedInput, String(env.NAV_PASSWORD_HASH).trim().toLowerCase());
  }

  if (env.NAV_PASSWORD) {
    return safeEqual(password, String(env.NAV_PASSWORD));
  }

  return false;
}

export function getSessionSecret(env) {
  return String(env.SESSION_SECRET || env.NAV_PASSWORD_HASH || env.NAV_PASSWORD || "");
}

export async function issueSessionCookie(env, remember = false) {
  const secret = getSessionSecret(env);

  if (!secret) {
    throw new Error("Missing session secret.");
  }

  const maxAge = remember ? REMEMBER_SESSION_SECONDS : DEFAULT_SESSION_SECONDS;
  const payload = {
    exp: Date.now() + maxAge * 1000,
    v: 1,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = await sign(encodedPayload, secret);
  const value = `${encodedPayload}.${signature}`;

  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function isAuthorized(request, env) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const token = readCookie(cookieHeader, SESSION_COOKIE_NAME);

  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return false;
  }

  const expectedSignature = await sign(payload, getSessionSecret(env));

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  let parsed;

  try {
    parsed = JSON.parse(fromBase64Url(payload));
  } catch (error) {
    return false;
  }

  return typeof parsed.exp === "number" && parsed.exp > Date.now();
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(signature);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function readCookie(cookieHeader, name) {
  for (const cookie of cookieHeader.split(";")) {
    const [key, ...rest] = cookie.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }

  return "";
}

function safeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

function toBase64Url(value) {
  const bytes =
    typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);

  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);

  return binary;
}
