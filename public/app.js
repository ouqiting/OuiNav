const state = {
  authenticated: false,
  links: [],
  pendingIconDataUrl: "",
};

const elements = {
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  authError: document.querySelector("#authError"),
  authSubmit: document.querySelector("#authSubmit"),
  rememberInput: document.querySelector("#rememberInput"),
  serviceGrid: document.querySelector("#serviceGrid"),
  emptyState: document.querySelector("#emptyState"),
  statusTitle: document.querySelector("#statusTitle"),
  statusText: document.querySelector("#statusText"),
  cardTemplate: document.querySelector("#serviceCardTemplate"),
  openCreateButton: document.querySelector("#openCreateButton"),
  createModal: document.querySelector("#createModal"),
  closeCreateButton: document.querySelector("#closeCreateButton"),
  createForm: document.querySelector("#createForm"),
  createSubmit: document.querySelector("#createSubmit"),
  createError: document.querySelector("#createError"),
  iconInput: document.querySelector("#iconInput"),
  iconPreview: document.querySelector("#iconPreview"),
};

boot();

async function boot() {
  bindEvents();

  try {
    const session = await requestJson("/api/session");
    if (session.authenticated) {
      unlockUi();
      await loadLinks();
      return;
    }
  } catch (error) {
    console.error(error);
  }

  lockUi();
}

function bindEvents() {
  elements.authForm.addEventListener("submit", handleAuthSubmit);
  elements.openCreateButton.addEventListener("click", () => openCreateModal());
  elements.closeCreateButton.addEventListener("click", closeCreateModal);
  elements.createModal.addEventListener("click", (event) => {
    if (event.target === elements.createModal) {
      closeCreateModal();
    }
  });
  elements.createForm.addEventListener("submit", handleCreateSubmit);
  elements.iconInput.addEventListener("change", handleIconChange);
}

function lockUi() {
  document.body.classList.add("modal-open");
  elements.authOverlay.classList.remove("hidden");
  elements.openCreateButton.classList.add("hidden");
  elements.serviceGrid.classList.add("hidden");
  elements.emptyState.classList.add("hidden");
  elements.statusTitle.textContent = "等待验证";
  elements.statusText.textContent = "输入密码后加载服务列表。支持记住登录状态。";
}

function unlockUi() {
  state.authenticated = true;
  document.body.classList.remove("modal-open");
  elements.authOverlay.classList.add("hidden");
  elements.openCreateButton.classList.remove("hidden");
  elements.statusTitle.textContent = "验证通过";
  elements.statusText.textContent = "服务列表已经从服务端读取完成，你可以继续添加新的入口。";
}

async function loadLinks() {
  const payload = await requestJson("/api/links");
  state.links = Array.isArray(payload.links) ? payload.links : [];
  renderLinks();
}

function renderLinks() {
  elements.serviceGrid.replaceChildren();

  if (!state.links.length) {
    elements.serviceGrid.classList.add("hidden");
    elements.emptyState.classList.remove("hidden");
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const link of state.links) {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const title = card.querySelector("h3");
    const description = card.querySelector("p");
    const fallback = card.querySelector(".service-icon-fallback");
    const image = card.querySelector(".service-icon-image");

    card.href = link.url;
    title.textContent = link.name;
    description.textContent = link.description || "未填写描述";
    fallback.textContent = getInitials(link.name);

    if (link.icon) {
      image.src = link.icon;
      image.classList.remove("hidden");
      fallback.classList.add("hidden");
    }

    fragment.append(card);
  }

  elements.serviceGrid.append(fragment);
  elements.emptyState.classList.add("hidden");
  elements.serviceGrid.classList.remove("hidden");
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.authForm);
  const password = String(formData.get("password") || "");
  const remember = Boolean(formData.get("remember"));

  setButtonLoading(elements.authSubmit, true, "验证中...");
  hideError(elements.authError);

  try {
    await requestJson("/api/auth", {
      method: "POST",
      body: JSON.stringify({ password, remember }),
    });

    unlockUi();
    await loadLinks();
    elements.authForm.reset();
  } catch (error) {
    showError(elements.authError, error.message || "密码错误，请重试");
  } finally {
    setButtonLoading(elements.authSubmit, false, "进入主页");
  }
}

function openCreateModal() {
  if (!state.authenticated) {
    return;
  }

  document.body.classList.add("modal-open");
  elements.createModal.classList.remove("hidden");
}

function closeCreateModal() {
  elements.createModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  elements.createForm.reset();
  resetIconPreview();
  hideError(elements.createError);
}

async function handleCreateSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.createForm);
  const payload = {
    name: String(formData.get("name") || "").trim(),
    url: String(formData.get("url") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    icon: state.pendingIconDataUrl,
  };

  setButtonLoading(elements.createSubmit, true, "添加中...");
  hideError(elements.createError);

  try {
    const response = await requestJson("/api/links", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    state.links = Array.isArray(response.links) ? response.links : state.links;
    renderLinks();
    closeCreateModal();
  } catch (error) {
    showError(elements.createError, error.message || "添加失败，请稍后重试。");
  } finally {
    setButtonLoading(elements.createSubmit, false, "添加到主页");
  }
}

async function handleIconChange(event) {
  const [file] = event.target.files || [];

  if (!file) {
    resetIconPreview();
    return;
  }

  try {
    state.pendingIconDataUrl = await imageFileToDataUrl(file, 112);
    elements.iconPreview.classList.add("has-image");
    elements.iconPreview.style.backgroundImage = `url("${state.pendingIconDataUrl}")`;
    elements.iconPreview.textContent = "";
  } catch (error) {
    resetIconPreview();
    showError(elements.createError, "图标处理失败，请换一张图片再试。");
  }
}

function resetIconPreview() {
  state.pendingIconDataUrl = "";
  elements.iconPreview.classList.remove("has-image");
  elements.iconPreview.style.backgroundImage = "";
  elements.iconPreview.textContent = "图标预览";
}

function showError(node, message) {
  node.textContent = message;
  node.classList.remove("hidden");
}

function hideError(node) {
  node.textContent = "";
  node.classList.add("hidden");
}

function setButtonLoading(button, loading, label) {
  button.disabled = loading;
  button.textContent = label;
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "SV";
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let payload = {};

  try {
    payload = await response.json();
  } catch (error) {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.message || "请求失败，请稍后重试。");
  }

  return payload;
}

async function imageFileToDataUrl(file, maxSize) {
  const dataUrl = await readAsDataUrl(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not supported.");
  }

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/webp", 0.86);
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image load failed"));
    image.src = src;
  });
}
