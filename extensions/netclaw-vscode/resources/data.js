(() => {
  "use strict";
  const vscode = acquireVsCodeApi(),
    viewId = document.body.dataset.viewId;
  const content = document.getElementById("content"),
    status = document.getElementById("status"),
    filter = document.getElementById("filter"),
    refresh = document.getElementById("refresh");
  let observation,
    invalidated = false,
    revision = 0,
    timer;
  const pages = new Map();
  let searchable = new WeakMap();
  const post = window.netclawPost(vscode, viewId);
  const text = (tag, value, parent) => {
    const element = document.createElement(tag);
    element.textContent = value;
    parent.appendChild(element);
    return element;
  };
  function matching(item, query) {
    if (!query) return true;
    if (item === null || typeof item !== "object")
      return String(item).toLocaleLowerCase().includes(query);
    if (!searchable.has(item))
      searchable.set(item, JSON.stringify(item).toLocaleLowerCase());
    return searchable.get(item).includes(query);
  }
  function draw() {
    const query = filter.value.trim().toLocaleLowerCase(),
      fragment = document.createDocumentFragment();
    let nodes = 0,
      bounded = false;
    function render(value, parent, location, depth) {
      if (++nodes > 10000 || depth > 16) {
        if (!bounded)
          text(
            "p",
            "Display limit reached. Narrow the source selection or filter.",
            parent,
          );
        bounded = true;
        return;
      }
      if (value === null || typeof value !== "object") {
        text("span", value === null ? "Unknown" : String(value), parent);
        return;
      }
      if (Array.isArray(value)) {
        const visible = value
          .map((item, index) => ({ item, index }))
          .filter((row) => matching(row.item, query));
        const page = Math.min(
            pages.get(location) || 0,
            Math.max(0, Math.ceil(visible.length / 50) - 1),
          ),
          start = page * 50;
        const summary = text(
          "p",
          visible.length
            ? `${start + 1}–${Math.min(start + 50, visible.length)} of ${visible.length} matching entries (${value.length} loaded)`
            : value.length
              ? "No loaded entries match this filter."
              : "No entries in this observed result.",
          parent,
        );
        summary.className = "hint";
        const section = document.createElement("section");
        section.setAttribute("aria-label", location);
        parent.appendChild(section);
        for (const { item, index } of visible.slice(start, start + 50)) {
          const article = document.createElement("article");
          article.dataset.entry = String(index);
          render(item, article, location + "[" + index + "]", depth + 1);
          section.appendChild(article);
          if (bounded) break;
        }
        if (visible.length > 50) {
          const controls = document.createElement("nav");
          controls.className = "toolbar";
          controls.setAttribute("aria-label", location + " pages");
          parent.appendChild(controls);
          for (const [label, delta, disabled] of [
            ["Previous entries", -1, page === 0],
            ["Next entries", 1, start + 50 >= visible.length],
          ]) {
            const button = text("button", label, controls);
            button.type = "button";
            button.disabled = disabled;
            button.dataset.pageControl = location + ":" + delta;
            button.setAttribute("aria-label", label + " for " + location);
            button.addEventListener("click", () => {
              pages.set(location, page + delta);
              draw();
              const buttons = [
                  ...content.querySelectorAll("button[data-page-control]"),
                ],
                replacement =
                  buttons.find(
                    (row) =>
                      row.dataset.pageControl === location + ":" + delta &&
                      !row.disabled,
                  ) ||
                  buttons.find(
                    (row) =>
                      row.dataset.pageControl.startsWith(location + ":") &&
                      !row.disabled,
                  );
              replacement?.focus();
            });
          }
        }
        return;
      }
      const dl = document.createElement("dl");
      for (const [key, item] of Object.entries(value)) {
        const dt = text("dt", key.replace(/([a-z])([A-Z])/g, "$1 $2"), dl),
          dd = document.createElement("dd");
        dt.title = key;
        render(item, dd, location + "." + key, depth + 1);
        dl.appendChild(dd);
        if (bounded) break;
      }
      parent.appendChild(dl);
    }
    if (observation !== undefined)
      render(observation, fragment, "observation", 0);
    content.replaceChildren(fragment);
    content.dataset.rendered = String(++revision);
    status.textContent = bounded
      ? "Observed result; display is bounded."
      : "Observed result" + (query ? " · local filter active" : "");
  }
  filter.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      pages.clear();
      if (!invalidated) draw();
    }, 80);
  });
  refresh.addEventListener("click", () => {
    if (invalidated) return;
    status.textContent = "Refreshing…";
    post("refresh");
  });
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.viewId !== viewId || invalidated) return;
    clearTimeout(timer);
    if (message.error) {
      observation = undefined;
      content.replaceChildren();
      status.textContent = String(message.error);
      if (message.invalidated) {
        invalidated = true;
        filter.disabled = true;
        refresh.disabled = true;
      }
      return;
    }
    let encoded;
    try {
      encoded = JSON.stringify(message.data);
    } catch {
      return;
    }
    if (
      typeof encoded !== "string" ||
      new TextEncoder().encode(encoded).length > 1024 * 1024
    ) {
      observation = undefined;
      content.replaceChildren();
      status.textContent =
        "Observation exceeds the display limit. Narrow the source selection.";
      return;
    }
    observation = message.data;
    pages.clear();
    searchable = new WeakMap();
    draw();
  });
  // Subscribe before requesting data: a fast backend must not outrun webview
  // initialization and leave an otherwise successful view empty.
  post("ready");
})();
