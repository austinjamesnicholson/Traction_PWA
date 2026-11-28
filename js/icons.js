const paths = {
  plus: "M12 5v14M5 12h14",
  edit: "m16 3 5 5-12 12-6 1 1-6Z M14 5l5 5",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
  grip: "M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01",
  up: "m6 15 6-6 6 6",
  down: "m6 9 6 6 6-6",
  check: "m5 12 4 4L19 6",
  copy: "M8 8h13v13H8ZM3 16V3h13",
  calendar: "M4 5h16v16H4ZM8 3v4M16 3v4M4 11h16",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${name === "grip" ? 3 : 1.7}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name === "grip" ? '<circle cx="8" cy="5" r="1"/><circle cx="16" cy="5" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="19" r="1"/><circle cx="16" cy="19" r="1"/>' : `<path d="${paths[name] || paths.plus}"/>`}</svg>`;
