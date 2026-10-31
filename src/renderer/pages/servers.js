import { Icon, EmptyState, Skeleton, escapeHtml } from '../components/ui.js';

const REGIONS = [
  { value: '', key: 'regionAll' },
  { value: 'North America', key: 'regionNA' },
  { value: 'Europe', key: 'regionEU' },
  { value: 'Asia', key: 'regionAsia' },
  { value: 'Middle East', key: 'regionME' },
  { value: 'Africa', key: 'regionAfrica' }
];
const local = {
  t: null, root: null,
  filters: { query: '', region: '', offlineSupported: false, version: '', tags: [], favoritesOnly: false, featuredOnly: false, sort: 'players' },
  servers: [], total: 0, totalPlayers: 0, loading: false, timer: null, requestId: 0
};

function fmt(value) {
  const n = Number(value) || 0;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

async function load() {
  if (!local.root) return;
  const requestId = ++local.requestId;
  local.loading = true;
  renderList(true);
  try {
    const result = await window.prime.servers.list(local.filters);
    if (requestId !== local.requestId || !local.root) return;
    if (!result?.ok) { local.servers = []; local.total = 0; local.totalPlayers = 0; return; }
    local.servers = Array.isArray(result.data?.servers) ? result.data.servers : [];
    local.total = Number(result.data?.total) || local.servers.length;
    local.totalPlayers = Number(result.data?.totalPlayers) || 0;
  } catch {
    local.servers = [];
    local.total = 0;
    local.totalPlayers = 0;
  } finally {
    if (requestId === local.requestId) {
      local.loading = false;
      renderList(false);
      renderTagCloud();
    }
  }
}

function renderList(loading) {
  if (!local.root) return;
  const t = local.t;
  const status = local.root.querySelector('[data-servers-status]');
  if (status) status.textContent = t('serversOnline').replace('{players}', fmt(local.totalPlayers)).replace('{servers}', local.total);
  const body = local.root.querySelector('[data-servers-list]');
  if (!body) return;
  if (loading && !local.servers.length) {
    body.innerHTML = Array.from({ length: 5 }, () => `<div class="server-card card">${Skeleton('55px', '55px')}<div style="flex:1">${Skeleton('40%')}${Skeleton('70%')}</div></div>`).join('');
    return;
  }
  if (!local.servers.length) {
    body.innerHTML = EmptyState({ title: t('noServers'), description: t('noServersDesc'), icon: 'server' });
    return;
  }
  body.innerHTML = local.servers.map((server, index) => `
    <article class="server-card card" data-server-id="${escapeHtml(server.id)}">
      <span class="server-rank mono">#${index + 1}</span><div class="server-avatar">${Icon('globe')}</div>
      <div class="server-info"><strong>${escapeHtml(server.name)} ${server.favorite ? Icon('star', 'icon-sm') : ''}</strong>
        <span><i class="online-dot ${server.online ? '' : 'offline'}"></i>${fmt(server.players)} ${t('playersOnline')}</span>
        <p class="content-desc">${escapeHtml(server.description || '')}</p>
        <div class="server-tags">${(server.tags || []).slice(0, 3).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      </div>
      <span class="badge mono">${escapeHtml(server.version)}</span>
      ${server.bannerUrl ? `<div class="server-banner" style="background-image:url('${escapeHtml(server.bannerUrl)}')"></div>` : ''}
      <div class="server-actions"><button class="icon-button" data-action="favorite-server" data-id="${escapeHtml(server.id)}" title="${escapeHtml(t('favorite'))}">${Icon('star', 'icon-sm')}</button>
        <button class="btn btn-primary btn-sm" data-action="join-server" data-address="${escapeHtml(server.address)}" ${server.online ? '' : 'disabled'}>${Icon('play', 'icon-sm')}<span>${t('joinServer')}</span></button></div>
    </article>`).join('');
}

function renderTagCloud() {
  if (!local.root) return;
  const counts = new Map();
  for (const server of local.servers) for (const tag of (server.tags || [])) counts.set(tag, (counts.get(tag) || 0) + 1);
  const element = local.root.querySelector('[data-tags-cloud]');
  if (!element) return;
  element.innerHTML = [...counts.entries()].slice(0, 12).map(([tag, count]) =>
    `<button class="chip ${local.filters.tags.includes(tag) ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)} <span class="chip-count mono">${count}</span></button>`).join('');
}

function renderFilters(t) {
  return `<div class="filter-panel">
    <button class="btn btn-ghost btn-sm" data-action="clear-server-filters">${t('clearFilters')}</button>
    <div class="filter-section"><h4>${t('favorite')} / ${t('featured')}</h4><div class="chip-row">
      <button class="chip ${local.filters.favoritesOnly ? 'active' : ''}" data-server-filter="favoritesOnly">${t('favorite')}</button>
      <button class="chip ${local.filters.featuredOnly ? 'active' : ''}" data-server-filter="featuredOnly">${t('featured')}</button>
    </div></div>
    <div class="filter-section"><h4>${t('region')}</h4><div class="chip-row">
      ${REGIONS.map((region) => `<button class="chip ${local.filters.region === region.value ? 'active' : ''}" data-region="${escapeHtml(region.value)}">${t(region.key)}</button>`).join('')}
    </div></div>
    <div class="filter-section"><h4>${t('accountType')}</h4><div class="chip-row">
      <button class="chip ${local.filters.offlineSupported ? 'active' : ''}" data-server-filter="offlineSupported">${t('offlineSupported')}</button>
    </div></div>
    <div class="filter-section"><h4>${t('versionFilter')}</h4><select class="field" data-server-version>
      <option value="">${t('all')}</option>
      ${['1.21', '1.20', '1.19', '1.16'].map((version) => `<option value="${version}" ${local.filters.version === version ? 'selected' : ''}>${version}</option>`).join('')}
    </select></div>
    <div class="filter-section"><h4>${t('tagsFilter')}</h4><div class="chip-row" data-tags-cloud></div></div>
  </div>`;
}

export function render(t) {
  local.t = t;
  return `<div class="page-content servers-page">
    <header class="page-header"><div><h1 class="page-title">${t('serversTitle')}</h1><p class="page-subtitle">${t('serversSubtitle')}</p></div></header>
    <div class="content-toolbar"><div class="field-wrap has-icon content-search"><span class="field-icon">${Icon('search')}</span><input class="field" data-servers-search placeholder="${escapeHtml(t('serversSearchPlaceholder'))}"></div>
      <div class="content-toolbar-end"><span class="muted" data-servers-status></span><button class="icon-button" data-action="refresh-servers" title="${escapeHtml(t('refresh'))}">${Icon('refresh', 'icon-sm')}</button></div>
    </div>
    <div class="content-hub-layout"><div class="servers-list" data-servers-list></div><aside class="panel filter-side">${renderFilters(t)}</aside></div>
  </div>`;
}

export function mount(root, { t, showToast, onJoinServer }) {
  local.root = root;
  local.filters = { query: '', region: '', offlineSupported: false, version: '', tags: [], favoritesOnly: false, featuredOnly: false, sort: 'players' };
  load();
  const search = root.querySelector('[data-servers-search]');
  search?.addEventListener('input', () => {
    clearTimeout(local.timer);
    local.timer = setTimeout(() => { local.filters.query = search.value.trim(); load(); }, 300);
  });
  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-action="refresh-servers"]')) { load(); return; }
    if (event.target.closest('[data-action="clear-server-filters"]')) {
      local.filters = { query: '', region: '', offlineSupported: false, version: '', tags: [], favoritesOnly: false, featuredOnly: false, sort: 'players' };
      if (search) search.value = '';
      root.querySelector('.filter-side').innerHTML = renderFilters(t);
      load();
      return;
    }
    const regionButton = event.target.closest('[data-region]');
    if (regionButton) { local.filters.region = regionButton.dataset.region; root.querySelector('.filter-side').innerHTML = renderFilters(t); renderTagCloud(); load(); return; }
    const flagButton = event.target.closest('[data-server-filter]');
    if (flagButton) {
      const key = flagButton.dataset.serverFilter;
      local.filters[key] = !local.filters[key];
      root.querySelector('.filter-side').innerHTML = renderFilters(t);
      renderTagCloud(); load();
      return;
    }
    const tagButton = event.target.closest('[data-tag]');
    if (tagButton) {
      const tag = tagButton.dataset.tag;
      const index = local.filters.tags.indexOf(tag);
      if (index >= 0) local.filters.tags.splice(index, 1); else local.filters.tags.push(tag);
      tagButton.classList.toggle('active');
      load();
      return;
    }
    const favoriteButton = event.target.closest('[data-action="favorite-server"]');
    if (favoriteButton) {
      const result = await window.prime.servers.toggleFavorite({ id: favoriteButton.dataset.id });
      if (result?.ok) showToast(result.data.favorite ? t('favoriteAdded') : t('favoriteRemoved'));
      else showToast(result?.error?.message || t('error'), 'error');
      load();
      return;
    }
    const joinButton = event.target.closest('[data-action="join-server"]');
    if (joinButton && !joinButton.disabled) onJoinServer(joinButton.dataset.address);
  });
  root.addEventListener('change', (event) => {
    const versionSelect = event.target.closest('[data-server-version]');
    if (versionSelect) { local.filters.version = versionSelect.value; load(); }
  });
  return () => {
    clearTimeout(local.timer);
    local.requestId += 1;
    local.loading = false;
    local.root = null;
    local.servers = [];
  };
}

export default { render, mount };
