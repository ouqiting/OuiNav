import { clearSessionCookie, issueSessionCookie, verifyPassword } from "../utils/auth.js";
import { json } from "../utils/response.js";

export async function onRequestPost(context) {
  let body = {};

  try {
    body = await context.request.json();
  } catch (error) {
    return json({ message: "请求格式无效。" }, { status: 400 });
  }

  const password = String(body.password || "");
  const remember = Boolean(body.remember);
  const valid = await verifyPassword(password, context.env);

  if (!valid) {
    return json({ message: "密码错误，请重试" }, { status: 401 });
  }

  const headers = new Headers();
  headers.append("Set-Cookie", await issueSessionCookie(context.env, remember));

  return json({ ok: true }, { headers });
}

export async function onRequestDelete(context) {
  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie());
  return json({ ok: true }, { headers });
}
