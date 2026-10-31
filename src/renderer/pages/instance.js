import { Icon, EmptyState, escapeHtml } from '../components/ui.js';

const local = {
  t: null, root: null, instance: null, tab: 'content', subTab: 'mods', mods: [], worlds: [], screenshots: [],
  logs: [], unsubscribeLog: null, unsubscribeProgress: null, launching: false, requestId: 0
};
const SUB_TABS = [
  { id: 'mods', key: 'modsCount' },
  { id: 'resourcepacks', key: 'resourcePacksCount' },
  { id: 'shaders', key: 'shadersCount' },
  { id: 'datapacks', key: 'dataPacksCount' }
];

function localFileUrl(filePath) {
  const normalized = String(filePath || '').replace(/\\/g, '/');
  return normalized.match(/^[a-zA-Z]:\//) ? `file:///${normalized}` : `file://${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

async function loadAll(id) {
  const requestId = ++local.requestId;
  try {
    const [instance, mods, worlds, screenshots] = await Promise.all([
      window.prime.instances.get({ id }), window.prime.instances.mods({ id }),
      window.prime.instances.worlds({ id }), window.prime.instances.screenshots({ id })
    ]);
    if (requestId !== local.requestId || !local.root) return;
    local.instance = instance?.ok ? instance.data : null;
    local.mods = mods?.ok && Array.isArray(mods.data) ? mods.data : [];
    local.worlds = worlds?.ok && Array.isArray(worlds.data) ? worlds.data : [];
    local.screenshots = screenshots?.ok && Array.isArray(screenshots.data) ? screenshots.data : [];
  } catch {
    local.instance = null;
    local.mods = [];
    local.worlds = [];
    local.screenshots = [];
  }
  draw();
}

function headerHtml(t) {
  const instance = local.instance;
  if (!instance) return '';
  const statusKey = instance.status === 'ready' ? 'instanceStatusReady' : instance.status === 'installing' ? 'instanceStatusInstalling' : 'instanceStatusError';
  const icon = /^[a-z0-9-]+$/.test(instance.icon || '') ? instance.icon : 'grass';
  return `<div class="instance-header card"><button class="btn btn-ghost btn-sm" data-action="back-to-library">${Icon('arrow-left', 'icon-sm')}<span>${t('backToLibrary')}</span></button>
    <div class="instance-header-main"><div class="instance-big-icon">${Icon(icon, 'icon-lg')}</div><div><h1>${escapeHtml(instance.name)}</h1>
      <div class="instance-badges"><span class="badge">${escapeHtml(t(instance.loader) || instance.loader)}</span><span class="badge mono">${escapeHtml(instance.version)}</span></div></div></div>
    <button class="btn btn-primary btn-lg" data-action="launch-instance" data-id="${escapeHtml(instance.id)}" ${local.launching ? 'disabled' : ''}>${Icon(local.launching ? 'clock' : 'play')}<span>${local.launching ? t('launching') : t('launchInstance')}</span></button>
  </div>
  <div class="instance-stats card"><div><span class="muted">${t('status')}</span><strong>${t(statusKey)}</strong></div>
    <div><span class="muted">${t('lastPlayed')}</span><strong>${instance.lastPlayed ? new Date(instance.lastPlayed).toLocaleDateString() : '—'}</strong></div>
    <div><span class="muted">${t('playtime')}</span><strong class="mono">${Number(instance.playtimeMinutes) || 0} ${t('minutes')}</strong></div>
    <div class="instance-stat-actions"><button class="icon-button" data-action="open-instance-settings" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(t('instanceSettings'))}">${Icon('settings', 'icon-sm')}</button>
      <button class="icon-button" data-action="open-instance-folder" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(t('openFolder'))}">${Icon('folder', 'icon-sm')}</button>
      <button class="icon-button" data-action="toggle-console" title="${escapeHtml(t('console'))}">${Icon('terminal', 'icon-sm')}</button></div>
  </div>`;
}

function contentTabHtml(t) {
  const instance = local.instance;
  const subTabs = SUB_TABS.map((tab) => {
    const count = tab.id === 'mods' ? local.mods.length : 0;
    return `<button class="tab ${local.subTab === tab.id ? 'active' : ''}" data-subtab="${tab.id}">${t(tab.key).replace('{count}', count)}</button>`;
  }).join('');
  let body;
  if (local.subTab !== 'mods') {
    body = EmptyState({ title: t('noContentTypeAvailable'), description: t('featureComingSoon'), icon: 'package' });
  } else {
    const rows = local.mods.map((mod) => `<div class="mod-row" data-file="${escapeHtml(mod.fileName)}">
      <span class="mod-icon">${Icon('puzzle')}</span><div class="mod-info"><strong dir="ltr">${escapeHtml(mod.fileName)}</strong><span class="muted mono">${(Number(mod.bytes) / 1048576).toFixed(1)} MB</span></div>
      <button class="toggle small ${mod.enabled ? 'on' : ''}" role="switch" aria-checked="${Boolean(mod.enabled)}" data-action="toggle-mod" data-file="${escapeHtml(mod.fileName)}" aria-label="${escapeHtml(mod.enabled ? t('disable') : t('enable'))}"></button>
    </div>`).join('');
    body = rows || EmptyState({ title: t('noMods'), icon: 'puzzle' });
  }
  return `<section class="card instance-tab-card">${instance?.linkedPack ? `<div class="linked-pack"><span class="badge">${Icon('package', 'icon-sm')}${escapeHtml(instance.linkedPack.name)}</span>
      <a class="text-link" href="#" data-action="open-pack-link">${t('openLink')}</a><button class="btn btn-ghost btn-sm" data-action="unlink-pack">${t('unlink')}</button>
      <button class="btn btn-outline btn-sm" data-action="update-pack">${t('updatePack')}</button></div>` : ''}
    ${local.mods.some((mod) => mod.duplicate) ? `<div class="warning-banner">${Icon('alert-circle', 'icon-sm')}<span>${t('duplicateModsWarning')}</span></div>` : ''}
    <div class="tabs sub-tabs">${subTabs}</div>
    <div class="content-toolbar"><div class="field-wrap has-icon"><span class="field-icon">${Icon('search', 'icon-sm')}</span><input class="field" data-mod-search placeholder="${escapeHtml(t('search'))}" ${local.subTab !== 'mods' ? 'disabled' : ''}></div>
      <div class="content-toolbar-end"><span class="muted">${t('enabledCount').replace('{enabled}', local.mods.filter((mod) => mod.enabled).length).replace('{total}', local.mods.length)}</span>
      <button class="btn btn-primary btn-sm" data-action="add-content">${Icon('plus', 'icon-sm')}<span>${t('addContent')}</span></button></div></div>
    <div class="mods-list" data-mods-list>${body}</div>
  </section>`;
}

function worldsTabHtml(t) {
  const rows = local.worlds.map((world) => `<div class="world-row"><span class="mod-icon">${Icon('globe')}</span><div class="mod-info"><strong>${escapeHtml(world.name)}</strong><span class="muted">${world.modifiedAt ? new Date(world.modifiedAt).toLocaleString() : ''}</span></div>
    <button class="btn btn-ghost btn-sm" disabled title="${escapeHtml(t('featureComingSoon'))}">${t('backupWorld')}</button></div>`).join('');
  return `<section class="card instance-tab-card"><div class="section-heading"><h2>${t('worldsCount').replace('{count}', local.worlds.length)}</h2><button class="btn btn-outline btn-sm" data-action="open-instance-folder" data-id="${escapeHtml(local.instance?.id || '')}">${Icon('folder', 'icon-sm')}<span>${t('openWorldsFolder')}</span></button></div>
    ${rows || EmptyState({ title: t('noWorlds'), icon: 'globe' })}</section>`;
}

function galleryTabHtml(t) {
  const items = local.screenshots.map((shot) => `<img class="screenshot-thumb" src="${escapeHtml(localFileUrl(shot.path))}" alt="${escapeHtml(shot.fileName || '')}" loading="lazy" data-full="${escapeHtml(localFileUrl(shot.path))}">`).join('');
  return `<section class="card instance-tab-card"><div class="section-heading"><h2>${t('screenshotsCount').replace('{count}', local.screenshots.length)}</h2><button class="btn btn-outline btn-sm" data-action="open-instance-folder" data-id="${escapeHtml(local.instance?.id || '')}">${Icon('folder', 'icon-sm')}<span>${t('openScreenshotsFolder')}</span></button></div>
    <div class="screenshots-grid">${items || EmptyState({ title: t('noScreenshots'), icon: 'image' })}</div></section>`;
}

function filesTabHtml(t) {
  return `<section class="card instance-tab-card"><div class="section-heading"><h2>${t('filesExplorer')}</h2><button class="btn btn-outline btn-sm" data-action="open-instance-folder" data-id="${escapeHtml(local.instance?.id || '')}">${Icon('folder', 'icon-sm')}<span>${t('openFolder')}</span></button></div>
    ${EmptyState({ title: t('filesExplorer'), description: t('filesExplorerNote'), icon: 'folder' })}</section>`;
}

function consoleHtml(t) {
  const lines = local.logs.map((line) => `<div class="log-line ${escapeHtml(line.level || 'info')}"><span class="mono">[${new Date(line.timestamp).toLocaleTimeString()}]</span> ${escapeHtml(line.message)}</div>`).join('');
  return `<section class="card console-card" data-console hidden><div class="section-heading"><h2>${t('consoleTitle')}</h2><div><button class="btn btn-ghost btn-sm" data-action="copy-log">${t('copyLog')}</button><button class="btn btn-ghost btn-sm" data-action="close-console">${t('closeConsole')}</button></div></div>
    <div class="console-output" data-console-output>${lines || `<div class="muted">${t('loading')}</div>`}</div></section>`;
}

function draw() {
  if (!local.root) return;
  const t = local.t;
  if (!local.instance) {
    local.root.innerHTML = EmptyState({ title: t('instanceNotFound'), description: t('backToLibrary'), icon: 'archive' });
    return;
  }
  const tabs = [
    { id: 'content', label: t('content') }, { id: 'worlds', label: t('worlds') },
    { id: 'gallery', label: t('gallery') }, { id: 'files', label: t('files') }
  ];
  const tabContent = local.tab === 'content' ? contentTabHtml(t) : local.tab === 'worlds' ? worldsTabHtml(t) : local.tab === 'gallery' ? galleryTabHtml(t) : filesTabHtml(t);
  local.root.innerHTML = `${headerHtml(t)}<div class="tabs instance-tabs">${tabs.map((tab) => `<button class="tab ${local.tab === tab.id ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>`).join('')}</div>${tabContent}${consoleHtml(t)}`;
}

export function render(t) {
  local.t = t;
  return `<div class="page-content instance-page" data-instance-root></div>`;
}

export function mount(root, { t, instanceId, showToast, openInstanceSettings }) {
  local.t = t;
  local.root = root;
  local.instance = null;
  local.tab = 'content';
  local.subTab = 'mods';
  local.logs = [];
  local.launching = false;
  void loadAll(instanceId);

  local.unsubscribeLog?.();
  local.unsubscribeProgress?.();
  local.unsubscribeLog = window.prime.launch.onLog((payload) => {
    if (payload.instanceId !== instanceId) return;
    local.logs.push(payload);
    if (local.logs.length > 3000) local.logs.splice(0, local.logs.length - 3000);
    const output = root.querySelector('[data-console-output]');
    if (output) {
      output.insertAdjacentHTML('beforeend', `<div class="log-line ${escapeHtml(payload.level || 'info')}"><span class="mono">[${new Date(payload.timestamp).toLocaleTimeString()}]</span> ${escapeHtml(payload.message)}</div>`);
      output.scrollTop = output.scrollHeight;
    }
  });
  local.unsubscribeProgress = window.prime.launch.onProgress((payload) => {
    if (payload.instanceId !== instanceId) return;
    local.launching = Number(payload.percent) < 100;
    const button = root.querySelector('[data-action="launch-instance"]');
    if (button) {
      button.disabled = local.launching;
      const label = button.querySelector('span');
      if (label) label.textContent = local.launching ? t('launching') : t('launchInstance');
    }
  });

  root.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-tab]');
    if (tabButton) { local.tab = tabButton.dataset.tab; draw(); return; }
    const subTabButton = event.target.closest('[data-subtab]');
    if (subTabButton) { local.subTab = subTabButton.dataset.subtab; draw(); return; }
    if (event.target.closest('[data-action="back-to-library"]')) { window.dispatchEvent(new CustomEvent('prime:navigate', { detail: { route: 'library' } })); return; }
    if (event.target.closest('[data-action="open-instance-settings"]')) { event.stopPropagation(); openInstanceSettings(instanceId); return; }
    if (event.target.closest('[data-action="open-instance-folder"]')) { event.stopPropagation(); const result = await window.prime.instances.openFolder({ id: instanceId }); if (!result?.ok) showToast(result?.error?.message || t('error'), 'error'); return; }
    if (event.target.closest('[data-action="toggle-console"]')) { const consolePanel = root.querySelector('[data-console]'); if (consolePanel) consolePanel.hidden = !consolePanel.hidden; return; }
    if (event.target.closest('[data-action="close-console"]')) { const consolePanel = root.querySelector('[data-console]'); if (consolePanel) consolePanel.hidden = true; return; }
    if (event.target.closest('[data-action="copy-log"]')) {
      try { await navigator.clipboard.writeText(local.logs.map((line) => line.message).join('\n')); showToast(t('copied')); }
      catch { showToast(t('copyFailed'), 'error'); }
      return;
    }
    if (event.target.closest('[data-action="launch-instance"]')) {
      const result = await window.prime.launch.start({ instanceId });
      if (result?.ok) showToast(result.data?.status === 'mock' ? t('launchMock') : t('launchStarted'));
      else showToast(result?.error?.message || t('error'), 'error');
      return;
    }
    if (event.target.closest('[data-action="add-content"]')) { window.dispatchEvent(new CustomEvent('prime:navigate', { detail: { route: 'content' } })); return; }
    const toggleMod = event.target.closest('[data-action="toggle-mod"]');
    if (toggleMod) {
      const result = await window.prime.instances.toggleMod({ id: instanceId, fileName: toggleMod.dataset.file });
      if (!result?.ok) showToast(result?.error?.message || t('error'), 'error');
      await loadAll(instanceId);
      return;
    }
    if (event.target.closest('[data-action="unlink-pack"]')) {
      const result = await window.prime.content.unlinkPack({ instanceId });
      if (result?.ok) showToast(t('packUnlinked')); else showToast(result?.error?.message || t('error'), 'error');
      await loadAll(instanceId);
      return;
    }
    if (event.target.closest('[data-action="update-pack"]')) {
      const result = await window.prime.content.updatePack({ instanceId });
      if (result?.ok) showToast(t('packUpdated').replace('{version}', result.data.version)); else showToast(result?.error?.message || t('error'), 'error');
      await loadAll(instanceId);
      return;
    }
    if (event.target.closest('[data-action="open-pack-link"]')) {
      event.preventDefault();
      const linkedPack = local.instance?.linkedPack;
      if (!linkedPack) return;
      const url = linkedPack.source === 'curseforge'
        ? `https://www.curseforge.com/minecraft/modpacks/${encodeURIComponent(linkedPack.projectId)}`
        : `https://modrinth.com/modpack/${encodeURIComponent(linkedPack.projectId)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const screenshot = event.target.closest('.screenshot-thumb');
    if (screenshot) window.open(screenshot.dataset.full, '_blank', 'noopener,noreferrer');
  });

  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-mod-search]')) {
      const query = event.target.value.toLowerCase();
      root.querySelectorAll('.mod-row').forEach((row) => { row.hidden = !row.dataset.file.toLowerCase().includes(query); });
    }
  });

  return () => {
    local.requestId += 1;
    local.unsubscribeLog?.();
    local.unsubscribeProgress?.();
    local.unsubscribeLog = null;
    local.unsubscribeProgress = null;
    local.root = null;
    local.logs = [];
  };
}

export default { render, mount };
