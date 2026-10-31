import { Icon, Dropdown, EmptyState, Skeleton, escapeHtml } from '../components/ui.js';

const local = { t: null, root: null, instances: [], query: '', sort: 'lastPlayed', view: 'grid', timer: null };
const SORTS = [
  { value: 'lastPlayed', labelKey: 'sortLastPlayed' },
  { value: 'name', labelKey: 'sortName' },
  { value: 'playtime', labelKey: 'sortPlaytime' }
];

function fmtDuration(minutes, t) {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return hours ? `${hours}${t('hours')} ${remainder}${t('minutes')}` : `${remainder}${t('minutes')}`;
}

function lastPlayedLabel(instance, t) {
  if (!instance.lastPlayed) return t('lastPlayed');
  const timestamp = new Date(instance.lastPlayed).getTime();
  if (!Number.isFinite(timestamp)) return t('lastPlayed');
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return t('playedToday');
  if (days === 1) return t('playedYesterday');
  if (days < 7) return t('playedDaysAgo').replace('{count}', days);
  return t('playedOn').replace('{date}', new Date(instance.lastPlayed).toLocaleDateString(document.documentElement.lang === 'ar' ? 'ar-DZ' : 'en-US'));
}

function filtered() {
  const query = local.query.toLowerCase();
  const list = local.instances.filter((instance) => instance.name.toLowerCase().includes(query));
  if (local.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (local.sort === 'playtime') list.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);
  else list.sort((a, b) => new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0));
  return list;
}

function cardHtml(instance, t) {
  const icon = /^[a-z0-9-]+$/.test(instance.icon || '') ? instance.icon : 'grass';
  return `<article class="instance-card card" data-instance-id="${escapeHtml(instance.id)}">
    <div class="instance-card-head"><div class="instance-icon">${Icon(icon)}</div>
      <div class="instance-card-title"><h3>${escapeHtml(instance.name)}</h3><span class="muted">${lastPlayedLabel(instance, t)}</span></div>
    </div>
    <div class="instance-card-meta"><span class="badge">${Icon('clock', 'icon-sm')}${fmtDuration(instance.playtimeMinutes, t)}</span>
      <span class="badge badge-loader-${escapeHtml(instance.loader)}">${escapeHtml(t(instance.loader) || instance.loader)}</span><span class="badge mono">${escapeHtml(instance.version)}</span>
    </div>
    <div class="instance-card-actions"><button class="btn btn-primary btn-sm" data-action="play-instance" data-id="${escapeHtml(instance.id)}">${Icon('play', 'icon-sm')}<span>${t('launch')}</span></button>
      <button class="icon-button" data-action="export-instance" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(t('exportInstance'))}">${Icon('download', 'icon-sm')}</button>
      <button class="icon-button" data-action="open-instance-settings" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(t('openSettings'))}">${Icon('settings', 'icon-sm')}</button>
    </div>
  </article>`;
}

export function render(t) {
  local.t = t;
  return `<div class="page-content library-page">
    <header class="page-header"><div><h1 class="page-title">${t('libraryTitle')}</h1><p class="page-subtitle">${t('librarySubtitle')}</p></div>
      <div class="page-header-actions"><div class="dropdown"><button class="btn btn-outline" data-action="open-dropdown">${Icon('upload', 'icon-sm')}<span>${t('importInstance')}</span>${Icon('chevron-down', 'icon-sm')}</button>
        <div class="dropdown-menu" hidden><button class="dropdown-item" data-action="import-instance-file">${t('importZip')}</button></div></div>
        <button class="btn btn-primary" data-action="new-instance">${Icon('plus', 'icon-sm')}<span>${t('newVersion')}</span></button>
      </div>
    </header>
    <div class="content-toolbar"><div class="field-wrap has-icon content-search"><span class="field-icon">${Icon('search')}</span><input class="field" data-library-search placeholder="${escapeHtml(t('searchPlaceholder'))}"></div>
      <div class="content-toolbar-end"><span class="muted" data-instances-count></span>${Dropdown({ label: t('sortLastPlayed'), options: SORTS.map((item) => ({ value: item.value, label: t(item.labelKey) })), action: 'sort-library' })}
        <button class="icon-button" data-action="toggle-library-view" title="${escapeHtml(t('toggleView'))}">${Icon(local.view === 'grid' ? 'layout-grid' : 'list', 'icon-sm')}</button></div>
    </div>
    <div class="instances-grid ${local.view === 'list' ? 'list' : ''}" data-instances-grid></div>
  </div>`;
}

export function mount(root, { t, instances = [], showToast, refreshInstances, openInstanceSettings }) {
  local.root = root;
  local.instances = Array.isArray(instances) ? instances : [];
  const draw = (loading = false) => {
    const grid = root.querySelector('[data-instances-grid]');
    const count = root.querySelector('[data-instances-count]');
    const list = filtered();
    if (count) count.textContent = t('instancesCount').replace('{count}', local.instances.length);
    if (!grid) return;
    grid.classList.toggle('list', local.view === 'list');
    if (loading) { grid.innerHTML = Array.from({ length: 6 }, () => `<div class="instance-card card">${Skeleton('100%', '80px')}${Skeleton('60%')}</div>`).join(''); return; }
    grid.innerHTML = list.length ? list.map((instance) => cardHtml(instance, t)).join('') : EmptyState({ title: t('noInstances'), description: t('noInstancesDesc'), icon: 'archive' });
  };
  draw();

  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-library-search]')) {
      clearTimeout(local.timer);
      const value = event.target.value.trim();
      local.timer = setTimeout(() => { local.query = value; draw(); }, 180);
    }
  });

  root.addEventListener('click', async (event) => {
    const sortButton = event.target.closest('[data-action="sort-library"]');
    if (sortButton) { local.sort = sortButton.dataset.value; draw(); return; }
    if (event.target.closest('[data-action="toggle-library-view"]')) {
      local.view = local.view === 'grid' ? 'list' : 'grid';
      draw();
      const button = root.querySelector('[data-action="toggle-library-view"]');
      if (button) button.innerHTML = Icon(local.view === 'grid' ? 'layout-grid' : 'list', 'icon-sm');
      return;
    }
    if (event.target.closest('[data-action="import-instance-file"]')) {
      const picked = await window.prime.instances.selectImportFile();
      if (!picked?.ok) { showToast(picked?.error?.message || t('importFailed').replace('{message}', t('error')), 'error'); return; }
      if (!picked.data?.filePath) return;
      const result = await window.prime.instances.import({ filePath: picked.data.filePath });
      if (!result?.ok) { showToast(result?.error?.message || t('importFailed').replace('{message}', t('error')), 'error'); return; }
      const refreshed = await refreshInstances?.();
      if (Array.isArray(refreshed)) local.instances = refreshed;
      window.dispatchEvent(new CustomEvent('prime:instances-updated'));
      showToast(t('instanceImported'));
      return;
    }
    const exportButton = event.target.closest('[data-action="export-instance"]');
    if (exportButton) {
      const result = await window.prime.instances.export({ id: exportButton.dataset.id });
      if (result?.ok && result.data?.filePath) showToast(t('instanceExported').replace('{path}', result.data.filePath));
      else showToast(result?.error?.message || t('exportFailed'), 'error');
      return;
    }
    const settingsButton = event.target.closest('[data-action="open-instance-settings"]');
    if (settingsButton) { event.stopPropagation(); openInstanceSettings(settingsButton.dataset.id); return; }
    const card = event.target.closest('.instance-card');
    if (card && !event.target.closest('button')) {
      window.dispatchEvent(new CustomEvent('prime:navigate-instance', { detail: { id: card.dataset.instanceId } }));
    }
  });

  root.addEventListener('contextmenu', (event) => {
    const card = event.target.closest('.instance-card');
    if (!card) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('prime:context-instance', { detail: { id: card.dataset.instanceId, x: event.clientX, y: event.clientY } }));
  });

  return () => { clearTimeout(local.timer); local.root = null; };
}

export default { render, mount };
