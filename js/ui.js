export const esc = (value = "") =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
export const time = (value) =>
  new Date(value).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
export const number = (value) =>
  Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
export const empty = (title, detail = "") =>
  `<div class="empty"><span class="empty-icon" aria-hidden="true">◇</span><h3>${esc(title)}</h3><p>${esc(detail)}</p></div>`;
export function heading(kicker, title, subtitle, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${esc(kicker)}</p><h1>${esc(title)}</h1><p class="muted">${esc(subtitle)}</p></div>${action}</div>`;
}
export function notify(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => node.classList.remove("visible"), 4000);
}
export function modal(title, body, onSubmit, submitLabel = "Save") {
  const dialog = document.querySelector("#modal");
  dialog.innerHTML = `<form><div class="section-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="quiet" data-close aria-label="Close dialog">✕</button></div>${body}<div class="actions"><button type="button" class="secondary" data-close>Cancel</button>${onSubmit ? `<button class="primary" type="submit">${esc(submitLabel)}</button>` : ""}</div></form>`;
  dialog
    .querySelectorAll("[data-close]")
    .forEach((button) => (button.onclick = () => dialog.close()));
  dialog.querySelector("form").onsubmit = async (event) => {
    event.preventDefault();
    if (!onSubmit) return;
    try {
      if ((await onSubmit(new FormData(event.target))) !== false)
        dialog.close();
    } catch (error) {
      notify(error.message);
    }
  };
  dialog.showModal();
  return dialog;
}
export function download(name, contents) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
