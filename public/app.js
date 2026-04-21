const THEME_STORAGE_KEY = "ouinav-theme";
const LONG_PRESS_DELAY_MS = 260;
const DRAG_CANCEL_DISTANCE = 8;

const state = {
  authenticated: false,
  links: [],
  pendingIconDataUrl: "",
  editingId: "",
  theme: "light",
  sortSession: null,
};

const elements = {
  authOverlay: document.querySelector("#authOverlay"),
  authForm: document.querySelector("#authForm"),
  authError: document.querySelector("#authError"),
  authSubmit: document.querySelector("#authSubmit"),
  passwordInput: document.querySelector("#passwordInput"),
  togglePasswordButton: document.querySelector("#togglePasswordButton"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  themeIconSun: document.querySelector("#themeIconSun"),
  themeIconMoon: document.querySelector("#themeIconMoon"),
  logoutButton: document.querySelector("#logoutButton"),
  rememberInput: document.querySelector("#rememberInput"),
  serviceGrid: document.querySelector("#serviceGrid"),
  emptyState: document.querySelector("#emptyState"),
  topbar: document.querySelector("#topbar"),
  cardTemplate: document.querySelector("#serviceCardTemplate"),
  openCreateButton: document.querySelector("#openCreateButton"),
  createModal: document.querySelector("#createModal"),
  closeCreateButton: document.querySelector("#closeCreateButton"),
  createForm: document.querySelector("#createForm"),
  createSubmit: document.querySelector("#createSubmit"),
  createError: document.querySelector("#createError"),
  editingIdInput: document.querySelector("#editingIdInput"),
  createTitle: document.querySelector("#createTitle"),
  iconInput: document.querySelector("#iconInput"),
  iconPreview: document.querySelector("#iconPreview"),
  iconPreviewImage: document.querySelector("#iconPreviewImage"),
  iconPreviewText: document.querySelector("#iconPreviewText"),
};

boot();

async function boot() {
  await cleanupLegacyServiceWorkers();
  initializeTheme();
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
  elements.togglePasswordButton.addEventListener("click", togglePasswordVisibility);
  elements.themeToggleButton.addEventListener("click", handleThemeToggle);
  elements.logoutButton.addEventListener("click", handleLogout);
  elements.openCreateButton.addEventListener("click", openCreateModal);
  elements.closeCreateButton.addEventListener("click", closeCreateModal);
  elements.createForm.addEventListener("submit", handleCreateSubmit);
  elements.iconInput.addEventListener("change", handleIconChange);
}

function lockUi() {
  document.body.classList.add("modal-open");
  elements.authOverlay.classList.remove("hidden");
  elements.topbar.classList.add("hidden");
  elements.openCreateButton.classList.add("hidden");
  elements.serviceGrid.classList.add("hidden");
  elements.emptyState.classList.add("hidden");
}

function unlockUi() {
  state.authenticated = true;
  document.body.classList.remove("modal-open");
  elements.authOverlay.classList.add("hidden");
  elements.topbar.classList.remove("hidden");
  elements.openCreateButton.classList.remove("hidden");
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

  state.links.forEach((link, indexValue) => {
    const card = elements.cardTemplate.content.firstElementChild.cloneNode(true);
    const dragHandle = card.querySelector(".drag-handle");
    const index = card.querySelector(".service-index");
    const cardLink = card.querySelector(".service-main");
    const title = card.querySelector(".service-title-text");
    const description = card.querySelector("p");
    const inlineIcon = card.querySelector(".service-inline-icon");
    const inlineIconImage = card.querySelector(".service-inline-icon-image");
    const editButton = card.querySelector(".edit-button");
    const deleteButton = card.querySelector(".delete-button");

    card.dataset.id = link.id;
    index.textContent = `#${indexValue + 1}`;
    cardLink.href = link.url;
    title.textContent = link.name;
    const normalizedDescription = String(link.description || "").trim();
    description.textContent = normalizedDescription;
    description.classList.toggle("hidden", !normalizedDescription);

    if (link.icon) {
      inlineIconImage.src = link.icon;
      inlineIcon.classList.remove("hidden");
    }

    editButton.addEventListener("click", () => openEditModal(link));
    deleteButton.addEventListener("click", () => handleDeleteLink(link.id));
    initializeSortHandle(dragHandle, card, link.id);

    fragment.append(card);
  });

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
    elements.passwordInput.type = "password";
  } catch (error) {
    showError(elements.authError, error.message || "密码错误，请重试");
  } finally {
    setButtonLoading(elements.authSubmit, false, "登录");
  }
}

function openCreateModal() {
  if (!state.authenticated) {
    return;
  }

  state.editingId = "";
  elements.editingIdInput.value = "";
  elements.createSubmit.textContent = "添加到主页";
  elements.createTitle.textContent = "添加新的服务链接";
  document.body.classList.add("modal-open");
  elements.createModal.classList.remove("hidden");
}

function openEditModal(link) {
  state.editingId = link.id;
  elements.editingIdInput.value = link.id;
  elements.createForm.elements.name.value = link.name || "";
  elements.createForm.elements.url.value = link.url || "";
  elements.createForm.elements.description.value = link.description || "";
  state.pendingIconDataUrl = link.icon || "";

  if (link.icon) {
    renderIconPreview(link.icon);
  } else {
    resetIconPreview();
  }

  elements.createSubmit.textContent = "保存修改";
  elements.createTitle.textContent = "编辑服务链接";
  document.body.classList.add("modal-open");
  elements.createModal.classList.remove("hidden");
}

function closeCreateModal() {
  elements.createModal.classList.add("hidden");
  if (state.authenticated) {
    document.body.classList.remove("modal-open");
  }
  elements.createForm.reset();
  state.editingId = "";
  elements.editingIdInput.value = "";
  elements.createSubmit.textContent = "添加到主页";
  elements.createTitle.textContent = "添加新的服务链接";
  resetIconPreview();
  hideError(elements.createError);
}

async function handleCreateSubmit(event) {
  event.preventDefault();

  const formData = new FormData(elements.createForm);
  const payload = {
    id: state.editingId,
    name: String(formData.get("name") || "").trim(),
    url: String(formData.get("url") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    icon: state.pendingIconDataUrl,
  };

  setButtonLoading(elements.createSubmit, true, state.editingId ? "保存中..." : "添加中...");
  hideError(elements.createError);

  try {
    const response = await requestJson("/api/links", {
      method: state.editingId ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    state.links = Array.isArray(response.links) ? response.links : state.links;
    renderLinks();
    closeCreateModal();
  } catch (error) {
    showError(elements.createError, error.message || "保存失败，请稍后重试。");
  } finally {
    setButtonLoading(elements.createSubmit, false, "添加到主页");
  }
}

async function handleDeleteLink(id) {
  if (state.sortSession) {
    return;
  }

  const confirmed = window.confirm("确认删除这个导航项吗？");

  if (!confirmed) {
    return;
  }

  try {
    const response = await requestJson("/api/links", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    });

    state.links = Array.isArray(response.links) ? response.links : [];
    renderLinks();
  } catch (error) {
    window.alert(error.message || "删除失败，请稍后重试。");
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
    renderIconPreview(state.pendingIconDataUrl);
  } catch (error) {
    resetIconPreview();
    showError(elements.createError, "图标处理失败，请换一张图片再试。");
  }
}

async function handleLogout() {
  try {
    await requestJson("/api/auth", { method: "DELETE" });
  } catch (error) {
    console.error(error);
  } finally {
    state.authenticated = false;
    state.links = [];
    elements.serviceGrid.replaceChildren();
    elements.authForm.reset();
    elements.passwordInput.type = "password";
    closeCreateModal();
    lockUi();
  }
}

function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(storedTheme || (prefersDark ? "dark" : "light"));
}

function handleThemeToggle() {
  const nextTheme = state.theme === "light" ? "dark" : "light";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  elements.themeIconSun.classList.toggle("hidden", theme !== "light");
  elements.themeIconMoon.classList.toggle("hidden", theme !== "dark");
}

function resetIconPreview() {
  state.pendingIconDataUrl = "";
  elements.iconPreview.classList.remove("has-image");
  elements.iconPreviewImage.src = "";
  elements.iconPreviewImage.classList.add("hidden");
  elements.iconPreviewText.classList.remove("hidden");
}

function renderIconPreview(src) {
  elements.iconPreview.classList.add("has-image");
  elements.iconPreviewImage.src = src;
  elements.iconPreviewImage.classList.remove("hidden");
  elements.iconPreviewText.classList.add("hidden");
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

function togglePasswordVisibility() {
  const nextType = elements.passwordInput.type === "password" ? "text" : "password";
  elements.passwordInput.type = nextType;
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

async function cleanupLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.error(error);
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    } catch (error) {
      console.error(error);
    }
  }
}

function initializeSortHandle(handle, card, linkId) {
  handle.addEventListener("pointerdown", (pointerDownEvent) => {
    if (state.sortSession || pointerDownEvent.button === 2) {
      return;
    }

    pointerDownEvent.preventDefault();

    let dragStarted = false;
    const pointerId = pointerDownEvent.pointerId;
    const startX = pointerDownEvent.clientX;
    const startY = pointerDownEvent.clientY;
    const timer = window.setTimeout(() => {
      dragStarted = true;
      startSorting(card, linkId, pointerDownEvent.clientX, pointerDownEvent.clientY);
    }, LONG_PRESS_DELAY_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
    };

    const handlePointerMove = (pointerMoveEvent) => {
      if (pointerMoveEvent.pointerId !== pointerId) {
        return;
      }

      if (!dragStarted) {
        const movedX = Math.abs(pointerMoveEvent.clientX - startX);
        const movedY = Math.abs(pointerMoveEvent.clientY - startY);

        if (movedX > DRAG_CANCEL_DISTANCE || movedY > DRAG_CANCEL_DISTANCE) {
          cleanup();
        }

        return;
      }

      updateSorting(pointerMoveEvent.clientX, pointerMoveEvent.clientY);
    };

    const handlePointerUp = async (pointerUpEvent) => {
      if (pointerUpEvent.pointerId !== pointerId) {
        return;
      }

      cleanup();

      if (!dragStarted) {
        return;
      }

      await finishSorting();
    };

    const handlePointerCancel = () => {
      cleanup();

      if (dragStarted) {
        cancelSorting();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
  });
}

function startSorting(card, linkId, clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const placeholder = card.cloneNode(false);
  placeholder.className = "service-card sorting-placeholder";
  placeholder.style.height = `${rect.height}px`;
  placeholder.dataset.id = linkId;

  card.after(placeholder);
  card.classList.add("dragging");
  card.style.position = "fixed";
  card.style.top = `${rect.top}px`;
  card.style.left = `${rect.left}px`;
  card.style.width = `${rect.width}px`;
  card.style.pointerEvents = "none";
  card.style.margin = "0";

  state.sortSession = {
    linkId,
    card,
    placeholder,
    offsetX: clientX - rect.left,
    offsetY: clientY - rect.top,
    originalOrder: state.links.map((item) => item.id),
  };
}

function updateSorting(clientX, clientY) {
  const session = state.sortSession;

  if (!session) {
    return;
  }

  session.card.style.top = `${clientY - session.offsetY}px`;
  session.card.style.left = `${clientX - session.offsetX}px`;

  const hovered = document.elementFromPoint(clientX, clientY)?.closest(".service-card");

  if (!hovered || hovered === session.card || hovered === session.placeholder) {
    return;
  }

  const hoveredRect = hovered.getBoundingClientRect();
  const shouldInsertBefore = clientY < hoveredRect.top + hoveredRect.height / 2;
  const parent = session.placeholder.parentNode;

  if (!parent) {
    return;
  }

  parent.insertBefore(session.placeholder, shouldInsertBefore ? hovered : hovered.nextSibling);
}

async function finishSorting() {
  const session = state.sortSession;

  if (!session) {
    return;
  }

  session.placeholder.before(session.card);
  cleanupSortingSession(session);

  const nextOrder = [...elements.serviceGrid.children]
    .map((node) => node.dataset.id)
    .filter(Boolean);

  if (!orderChanged(session.originalOrder, nextOrder)) {
    state.sortSession = null;
    renderLinks();
    return;
  }

  try {
    const response = await requestJson("/api/links", {
      method: "PUT",
      body: JSON.stringify({ orderIds: nextOrder }),
    });

    state.links = Array.isArray(response.links) ? response.links : state.links;
  } catch (error) {
    window.alert(error.message || "排序保存失败，请稍后重试。");
  } finally {
    state.sortSession = null;
    renderLinks();
  }
}

function cancelSorting() {
  const session = state.sortSession;

  if (!session) {
    return;
  }

  session.placeholder.before(session.card);
  cleanupSortingSession(session);
  state.sortSession = null;
  renderLinks();
}

function cleanupSortingSession(session) {
  session.card.classList.remove("dragging");
  session.card.style.position = "";
  session.card.style.top = "";
  session.card.style.left = "";
  session.card.style.width = "";
  session.card.style.pointerEvents = "";
  session.card.style.margin = "";
  session.placeholder.remove();
}

function orderChanged(previousOrder, nextOrder) {
  if (previousOrder.length !== nextOrder.length) {
    return true;
  }

  return previousOrder.some((id, index) => id !== nextOrder[index]);
}
