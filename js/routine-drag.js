// Pointer events work on iPhone as well as desktop. Only the grip captures touch,
// leaving the rest of the editor available for normal page scrolling.
export function bindBlockDrag(container, onReorder) {
  container.querySelectorAll("[data-grip]").forEach((handle) => {
    let row,
      active = false,
      moved = false,
      lastY = 0,
      frame = null,
      startY = 0;
    const stopScroll = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };
    const autoScroll = () => {
      if (!active) return;
      const height = window.innerHeight;
      if (lastY < 100) window.scrollBy(0, -10);
      else if (lastY > height - 100) window.scrollBy(0, 10);
      frame = requestAnimationFrame(autoScroll);
    };
    const finish = () => {
      if (!active) return;
      active = false;
      stopScroll();
      row.classList.remove("block-dragging");
      document.body.classList.remove("routine-drag-active");
      if (moved)
        onReorder(
          [...container.querySelectorAll("[data-block-id]")].map(
            (node) => node.dataset.blockId,
          ),
        );
    };
    handle.onpointerdown = (event) => {
      if (event.button !== 0) return;
      row = handle.closest("[data-block-id]");
      active = true;
      moved = false;
      startY = lastY = event.clientY;
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    handle.onpointermove = (event) => {
      if (!active) return;
      lastY = event.clientY;
      if (!moved && Math.abs(lastY - startY) < 6) return;
      if (!moved) {
        moved = true;
        row.classList.add("block-dragging");
        document.body.classList.add("routine-drag-active");
        frame = requestAnimationFrame(autoScroll);
      }
      const candidates = [
        ...container.querySelectorAll("[data-block-id]"),
      ].filter((node) => node !== row);
      const next = candidates.find((node) => {
        const box = node.getBoundingClientRect();
        return event.clientY < box.top + box.height / 2;
      });
      if (next) container.insertBefore(row, next);
      else container.append(row);
      event.preventDefault();
    };
    handle.onpointerup = (event) => {
      if (active && handle.hasPointerCapture(event.pointerId))
        handle.releasePointerCapture(event.pointerId);
      finish();
    };
    handle.onpointercancel = finish;
    handle.onlostpointercapture = finish;
  });
}
