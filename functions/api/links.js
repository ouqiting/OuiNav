import { isAuthorized } from "../utils/auth.js";
import { json } from "../utils/response.js";
import { createLink, readLinks } from "../utils/storage.js";

export async function onRequestGet(context) {
  const authorized = await isAuthorized(context.request, context.env);

  if (!authorized) {
    return json({ message: "未授权访问。" }, { status: 401 });
  }

  const links = await readLinks(context.env);
  return json({ links });
}

export async function onRequestPost(context) {
  const authorized = await isAuthorized(context.request, context.env);

  if (!authorized) {
    return json({ message: "未授权访问。" }, { status: 401 });
  }

  let body = {};

  try {
    body = await context.request.json();
  } catch (error) {
    return json({ message: "请求格式无效。" }, { status: 400 });
  }

  try {
    const links = await createLink(context.env, body);
    return json({ links }, { status: 201 });
  } catch (error) {
    return json({ message: error.message || "保存失败。" }, { status: 400 });
  }
}
