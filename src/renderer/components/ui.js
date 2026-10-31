export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function Icon(name, size = '') {
  const safeName = /^[a-z0-9-]+$/.test(name) ? name : 'info';
  return `<img class="icon ${escapeHtml(size)}" src="../../assets/icons/${safeName}.svg" alt="" aria-hidden="true">`;
}

export function Button({ label = '', variant = 'primary', icon = '', action = '', disabled = false, className = '', type = 'button' } = {}) {
  return `<button type="${type}" class="btn btn-${escapeHtml(variant)} ${escapeHtml(className)}" ${action ? `data-action="${escapeHtml(action)}"` : ''} ${disabled ? 'disabled' : ''}>${icon ? Icon(icon) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export function Toggle({ checked = false, label = '', name = '', action = '' } = {}) {
  return `<button class="toggle" role="switch" aria-checked="${Boolean(checked)}" aria-label="${escapeHtml(label)}" data-setting="${escapeHtml(name)}" data-action="${escapeHtml(action || 'toggle-setting')}"></button>`;
}

export function Chip({ label = '', active = false, icon = '', value = '' } = {}) {
  return `<button class="chip ${active ? 'active' : ''}" data-chip="${escapeHtml(value || label)}">${icon ? Icon(icon, 'icon-sm') : ''}${escapeHtml(label)}</button>`;
}

export function Badge({ label = '', tone = '', icon = '' } = {}) {
  return `<span class="badge ${tone ? `badge-${escapeHtml(tone)}` : ''}">${icon ? Icon(icon, 'icon-sm') : ''}${escapeHtml(label)}</span>`;
}

export function Card(content, className = '') {
  return `<section class="card ${escapeHtml(className)}">${content}</section>`;
}

export function Modal({ title = '', body = '', footer = '', id = 'modal', closeLabel = title } = {}) {
  return `<div class="modal-backdrop" data-modal-backdrop="${escapeHtml(id)}"><section class="modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}"><header class="modal-header"><h2 class="modal-title">${escapeHtml(title)}</h2><button class="icon-button" data-action="close-modal" aria-label="${escapeHtml(closeLabel)}">${Icon('x')}</button></header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}</section></div>`;
}

export function Dropdown({ label = '', options = [], action = '' } = {}) {
  const items = options.map((option) => `<button class="dropdown-item" data-value="${escapeHtml(option.value)}" data-dropdown-option="true" ${action ? `data-action="${escapeHtml(action)}"` : ''}>${escapeHtml(option.label)}</button>`).join('');
  return `<div class="dropdown"><button class="btn btn-outline" data-action="open-dropdown">${escapeHtml(label)} ${Icon('chevron-down', 'icon-sm')}</button><div class="dropdown-menu" hidden>${items}</div></div>`;
}

export function Slider({ value = 50, min = 0, max = 100, label = '' } = {}) {
  return `<label class="slider-control"><span>${escapeHtml(label)}</span><input type="range" min="${min}" max="${max}" value="${value}" aria-label="${escapeHtml(label)}"></label>`;
}

export function Input({ placeholder = '', value = '', icon = '', name = '', type = 'text' } = {}) {
  return `<div class="field-wrap ${icon ? 'has-icon' : ''}">${icon ? `<span class="field-icon">${Icon(icon)}</span>` : ''}<input class="field" type="${escapeHtml(type)}" name="${escapeHtml(name)}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(value)}"></div>`;
}

export function Tooltip(label) {
  return `<span class="tooltip">${escapeHtml(label)}</span>`;
}

export function Toast(message, tone = 'success') {
  return `<div class="toast ${escapeHtml(tone)}">${Icon(tone === 'error' ? 'alert-circle' : 'check-circle')}<span>${escapeHtml(message)}</span></div>`;
}

export function Tabs(items = [], active = '') {
  return `<div class="tabs" role="tablist">${items.map((item) => `<button class="tab ${item.id === active ? 'active' : ''}" role="tab" aria-selected="${item.id === active}" data-tab="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join('')}</div>`;
}

export function Progress(value = 0) {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="progress" role="progressbar" aria-valuenow="${bounded}" aria-valuemin="0" aria-valuemax="100" style="--progress:${bounded}%"><span></span></div>`;
}

export function Skeleton(width = '100%', height = '14px') {
  return `<div class="skeleton" style="width:${escapeHtml(width)};height:${escapeHtml(height)}"></div>`;
}

export function EmptyState({ title = '', description = '', icon = 'package' } = {}) {
  return `<div class="empty-state"><div class="empty-icon">${Icon(icon, 'icon-lg')}</div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`;
}

export function ContextMenu(items = []) {
  return `<div class="context-menu" role="menu" hidden>${items.map((item) => `<button class="dropdown-item" role="menuitem" data-action="${escapeHtml(item.action)}" data-id="${escapeHtml(item.id || '')}">${item.icon ? Icon(item.icon, 'icon-sm') : ''}${escapeHtml(item.label)}</button>`).join('')}</div>`;
}
