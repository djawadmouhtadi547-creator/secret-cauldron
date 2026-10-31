import { escapeHtml } from './ui.js';

// Simple windowed renderer for long uniform rows. Row height must be fixed.
export function createVirtualList({ container, rowHeight = 56, overscan = 6, renderRow }) {
  let items = [];
  let scrollHandler = null;

  function totalHeight() { return items.length * rowHeight; }

  function render() {
    const scrollTop = container.scrollTop;
    const viewport = container.clientHeight || 400;
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
    const spacerTop = start * rowHeight;
    const spacerBottom = Math.max(0, totalHeight() - end * rowHeight);
    const rows = items.slice(start, end).map((item, index) => `<div class="virtual-row" style="height:${rowHeight}px">${renderRow(item, start + index)}</div>`).join('');
    container.innerHTML = `<div style="height:${spacerTop}px"></div>${rows}<div style="height:${spacerBottom}px"></div>`;
  }

  function update(nextItems) {
    items = Array.isArray(nextItems) ? nextItems : [];
    render();
  }

  function attach() {
    scrollHandler = () => render();
    container.addEventListener('scroll', scrollHandler, { passive: true });
  }
  function detach() {
    if (scrollHandler) container.removeEventListener('scroll', scrollHandler);
    scrollHandler = null;
    items = [];
  }

  attach();
  return { update, detach, refresh: render };
}

export function virtualSpacer(height) {
  return `<div style="height:${escapeHtml(String(height))}"></div>`;
}
