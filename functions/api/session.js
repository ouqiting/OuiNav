import { isAuthorized } from "../utils/auth.js";
import { json } from "../utils/response.js";

export async function onRequestGet(context) {
  const authenticated = await isAuthorized(context.request, context.env);
  return json({ authenticated });
}
