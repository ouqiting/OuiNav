const LINKS_KEY = "nav_links";

export async function readLinks(env) {
  const kvValue = env.NAV_LINKS_KV ? await env.NAV_LINKS_KV.get(LINKS_KEY) : null;

  if (kvValue) {
    return parseLinks(kvValue);
  }

  if (env.DEFAULT_LINKS_JSON) {
    return parseLinks(String(env.DEFAULT_LINKS_JSON));
  }

  return [];
}

export async function createLink(env, payload) {
  if (!env.NAV_LINKS_KV) {
    throw new Error("缺少 NAV_LINKS_KV 绑定，无法保存新链接。");
  }

  const links = await readLinks(env);
  const link = normalizeLink(payload);
  const nextLinks = [link, ...links];

  await env.NAV_LINKS_KV.put(LINKS_KEY, JSON.stringify(nextLinks));

  return nextLinks;
}

export async function updateLink(env, payload) {
  if (!env.NAV_LINKS_KV) {
    throw new Error("缺少 NAV_LINKS_KV 绑定，无法保存修改。");
  }

  const id = String(payload.id || "").trim();

  if (!id) {
    throw new Error("缺少链接 ID。");
  }

  const links = await readLinks(env);
  const index = links.findIndex((item) => item.id === id);

  if (index === -1) {
    throw new Error("未找到要编辑的导航项。");
  }

  const existing = links[index];
  const nextLink = normalizeLink({
    ...existing,
    ...payload,
    id,
  });
  nextLink.id = id;

  const nextLinks = [...links];
  nextLinks[index] = nextLink;

  await env.NAV_LINKS_KV.put(LINKS_KEY, JSON.stringify(nextLinks));

  return nextLinks;
}

export async function deleteLink(env, id) {
  if (!env.NAV_LINKS_KV) {
    throw new Error("缺少 NAV_LINKS_KV 绑定，无法删除链接。");
  }

  const targetId = String(id || "").trim();

  if (!targetId) {
    throw new Error("缺少链接 ID。");
  }

  const links = await readLinks(env);
  const nextLinks = links.filter((item) => item.id !== targetId);

  if (nextLinks.length === links.length) {
    throw new Error("未找到要删除的导航项。");
  }

  await env.NAV_LINKS_KV.put(LINKS_KEY, JSON.stringify(nextLinks));

  return nextLinks;
}

export async function reorderLinks(env, orderIds) {
  if (!env.NAV_LINKS_KV) {
    throw new Error("缺少 NAV_LINKS_KV 绑定，无法保存排序。");
  }

  if (!Array.isArray(orderIds) || !orderIds.length) {
    throw new Error("排序数据无效。");
  }

  const links = await readLinks(env);
  const linkMap = new Map(links.map((item) => [item.id, item]));

  if (linkMap.size !== orderIds.length) {
    throw new Error("排序数量不匹配。");
  }

  const nextLinks = orderIds.map((id) => {
    const normalizedId = String(id || "").trim();
    const link = linkMap.get(normalizedId);

    if (!link) {
      throw new Error("排序项中包含未知链接。");
    }

    linkMap.delete(normalizedId);
    return link;
  });

  if (linkMap.size) {
    throw new Error("排序项不完整。");
  }

  await env.NAV_LINKS_KV.put(LINKS_KEY, JSON.stringify(nextLinks));

  return nextLinks;
}

function parseLinks(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isLinkShape) : [];
  } catch (error) {
    return [];
  }
}

function normalizeLink(payload) {
  const id = String(payload.id || "").trim();
  const name = String(payload.name || "").trim();
  const description = String(payload.description || "").trim();
  const icon = String(payload.icon || "").trim();
  const url = normalizeUrl(payload.url);

  if (!name) {
    throw new Error("名称不能为空。");
  }

  if (!url) {
    throw new Error("网址格式不正确，请使用 http 或 https 开头。");
  }

  return {
    id: id || crypto.randomUUID(),
    name: name.slice(0, 40),
    description: description.slice(0, 90),
    url,
    icon: icon.slice(0, 250000),
  };
}

function normalizeUrl(value) {
  try {
    const parsed = new URL(String(value || "").trim());

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }

    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function isLinkShape(item) {
  return item && typeof item.name === "string" && typeof item.url === "string";
}
