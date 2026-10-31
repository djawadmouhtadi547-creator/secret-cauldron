import { Icon, Dropdown, EmptyState, Skeleton, escapeHtml } from '../components/ui.js';

const TYPE_KEYS = {
  modpack: 'typeModpack', mod: 'typeMod', resourcepack: 'typeResourcepack',
  shader: 'typeShader', datapack: 'typeDatapack', world: 'typeWorld'
};
const SORTS = [
  { value: 'downloads', labelKey: 'sortDownloads' },
  { value: 'follows', labelKey: 'sortFollows' },
  { value: 'updated', labelKey: 'sortUpdated' },
  { value: 'newest', labelKey: 'sortNewest' }
];
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const local = {
  t: null, query: '', source: 'modrinth', type: 'modpack', gameVersion: '', loader: '',
  sort: 'downloads', offset: 0, limit: 18, total: 0, hits: [], loading: false,
  view: 'grid', root: null, instances: [], targetInstanceId: '', searchTimer: null, requestId: 0
};

function fmt(value) {
  const n = Number(value) || 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

function cardHtml(project, t) {
  return `<article class="content-card card" data-project-id="${escapeHtml(project.id)}" data-source="${escapeHtml(project.source)}">
    <div class="content-banner" style="background-image:linear-gradient(180deg,transparent,rgba(0,0,0,.55)),url('${escapeHtml(project.bannerUrl || project.iconUrl || '')}')"><span class="project-source">${escapeHtml(String(project.source || '').toUpperCase())}</span></div>
    <div class="content-card-body">
      ${project.iconUrl ? `<img class="project-icon" src="${escapeHtml(project.iconUrl)}" alt="" loading="lazy">` : ''}
      <h3>${escapeHtml(project.title)}</h3>
      <p class="content-desc">${escapeHtml(project.description || '')}</p>
      <div class="project-meta">${Icon('user', 'icon-sm')}<span>${t('projectAuthor').replace('{author}', escapeHtml(project.author || ''))}</span><span class="download-count mono">${fmt(project.downloads)}</span></div>
      <div class="content-card-footer"><button class="btn btn-primary btn-sm" data-action="install-content" data-id="${escapeHtml(project.id)}" data-source="${escapeHtml(project.source)}" data-title="${escapeHtml(project.title)}">${Icon('download', 'icon-sm')}<span>${t('install')}</span></button></div>
    </div>
  </article>`;
}

function rowHtml(project, t) {
  return `<article class="content-row card" data-project-id="${escapeHtml(project.id)}" data-source="${escapeHtml(project.source)}">
    ${project.iconUrl ? `<img class="project-icon" src="${escapeHtml(project.iconUrl)}" alt="" loading="lazy">` : ''}
    <div class="content-row-info"><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.description || '')}</p><div class="project-meta">${Icon('user', 'icon-sm')}<span>${escapeHtml(project.author || '')}</span></div></div>
    <span class="download-count mono">${fmt(project.downloads)}</span>
    <button class="btn btn-primary btn-sm" data-action="install-content" data-id="${escapeHtml(project.id)}" data-source="${escapeHtml(project.source)}" data-title="${escapeHtml(project.title)}">${Icon('download', 'icon-sm')}<span>${t('install')}</span></button>
  </article>`;
}

async function fetchHits(reset = false) {
  if (!local.root) return;
  const requestId = ++local.requestId;
  local.loading = true;
  if (reset) { local.offset = 0; local.hits = []; }
  renderResults(true);
  try {
    const result = await window.prime.content.search({
      query: local.query || undefined, source: local.source, type: local.type,
      gameVersion: local.gameVersion || undefined, loader: local.loader || undefined,
      sort: local.sort, offset: local.offset, limit: local.limit
    });
    if (requestId !== local.requestId || !local.root) return;
    if (!result?.ok) {
      local.total = 0;
      renderResults(false);
      return;
    }
    const hits = Array.isArray(result.data?.hits) ? result.data.hits : [];
    local.total = Number(result.data?.totalHits) || 0;
    local.hits = reset ? hits : local.hits.concat(hits);
    local.offset = local.hits.length;
  } catch {
    if (requestId === local.requestId) local.total = 0;
  } finally {
    if (requestId === local.requestId) {
      local.loading = false;
      renderResults(false);
    }
  }
}

function renderResults(loading) {
  if (!local.root) return;
  const t = local.t;
  const countEl = local.root.querySelector('[data-results-count]');
  if (countEl) countEl.textContent = t('resultsCount').replace('{type}', t(TYPE_KEYS[local.type] || 'typeMod')).replace('{count}', local.total.toLocaleString());
  const body = local.root.querySelector('[data-content-results]');
  if (!body) return;
  if (loading && !local.hits.length) {
    body.innerHTML = Array.from({ length: 6 }, () => `<div class="content-card card">${Skeleton('100%', '120px')}${Skeleton('70%')}${Skeleton('95%')}</div>`).join('');
    return;
  }
  if (!local.hits.length) {
    body.innerHTML = EmptyState({ title: t('noResults'), description: t('noResultsDesc'), icon: 'search' });
    return;
  }
  body.className = local.view === 'grid' ? 'content-results grid' : 'content-results list';
  body.innerHTML = local.hits.map((project) => local.view === 'grid' ? cardHtml(project, t) : rowHtml(project, t)).join('') +
    (local.hits.length < local.total ? `<div class="load-more-wrap"><button class="btn btn-outline" data-action="load-more-content">${t('loadMore')}</button></div>` : '');
}

function renderFilters(t) {
  const typeChips = Object.entries(TYPE_KEYS).map(([value, key]) =>
    `<button class="chip ${local.type === value ? 'active' : ''}" data-filter="type" data-value="${value}">${t(key)}</button>`).join('');
  const loaderChips = LOADERS.map((loader) =>
    `<button class="chip ${local.loader === loader ? 'active' : ''}" data-filter="loader" data-value="${loader}">${t(loader)}</button>`).join('');
  return `<div class="filter-panel">
    <div class="filter-section"><h4>${t('source')}</h4><div class="chip-row">
      <button class="chip ${local.source === 'modrinth' ? 'active' : ''}" data-filter="source" data-value="modrinth">Modrinth</button>
      <button class="chip ${local.source === 'curseforge' ? 'active' : ''}" data-filter="source" data-value="curseforge">CurseForge</button>
    </div></div>
    <div class="filter-section"><h4>${t('contentType')}</h4><div class="chip-row">${typeChips}</div></div>
    <div class="filter-section"><h4>${t('gameVersion')}</h4><select class="field" data-filter-select="gameVersion">
      <option value="">${t('anyVersion')}</option>
      ${['1.21.4','1.21.1','1.20.6','1.20.1','1.19.2','1.18.2','1.16.5'].map((version) => `<option value="${version}" ${local.gameVersion === version ? 'selected' : ''}>${version}</option>`).join('')}
    </select></div>
    <div class="filter-section"><h4>${t('modLoaders')}</h4><div class="chip-row">
      <button class="chip ${!local.loader ? 'active' : ''}" data-filter="loader" data-value="">${t('all')}</button>${loaderChips}
    </div></div>
    <button class="btn btn-ghost btn-sm" data-action="clear-content-filters">${t('clearFilters')}</button>
  </div>`;
}

function renderInstallTarget(t) {
  const select = `<label class="install-target"><span>${t('installToInstance')}</span><select class="field" data-install-target ${local.instances.length ? '' : 'disabled'}>
    ${local.instances.map((instance) => `<option value="${escapeHtml(instance.id)}" ${instance.id === local.targetInstanceId ? 'selected' : ''}>${escapeHtml(instance.name)}</option>`).join('')}
  </select></label>`;
  return local.instances.length ? select : `<span class="muted small">${t('noInstancesForInstall')}</span>`;
}

export function render(t) {
  local.t = t;
  return `<div class="page-content content-hub-page">
    <header class="page-header"><div><h1 class="page-title">${t('contentHubTitle')}</h1><p class="page-subtitle">${t('contentHubSubtitle')}</p></div></header>
    <div class="content-toolbar">
      <div class="field-wrap has-icon content-search"><span class="field-icon">${Icon('search')}</span><input class="field" data-content-search placeholder="${escapeHtml(t('contentSearchPlaceholder'))}"></div>
      <div class="content-toolbar-end"><span class="muted" data-results-count></span>${Dropdown({ label: t('sortDownloads'), options: SORTS.map((item) => ({ value: item.value, label: t(item.labelKey) })), action: 'sort-content' })}
        <button class="icon-button" data-action="toggle-content-view" title="${escapeHtml(t('gridView'))}">${Icon(local.view === 'grid' ? 'layout-grid' : 'list', 'icon-sm')}</button>
      </div>
    </div>
    <div class="content-toolbar content-target-toolbar">${renderInstallTarget(t)}</div>
    <div class="content-hub-layout"><div class="content-results grid" data-content-results></div><aside class="panel filter-side">${renderFilters(t)}</aside></div>
  </div>`;
}

export function mount(root, { t, instances = [], showToast }) {
  local.root = root;
  local.instances = Array.isArray(instances) ? instances : [];
  local.targetInstanceId = local.instances.find((instance) => instance.status === 'ready')?.id || local.instances[0]?.id || '';
  const select = root.querySelector('[data-install-target]');
  if (select && local.targetInstanceId) select.value = local.targetInstanceId;
  fetchHits(true);

  const search = root.querySelector('[data-content-search]');
  search?.addEventListener('input', () => {
    clearTimeout(local.searchTimer);
    local.searchTimer = setTimeout(() => { local.query = search.value.trim(); fetchHits(true); }, 300);
  });

  root.addEventListener('click', async (event) => {
    const filter = event.target.closest('[data-filter]');
    if (filter) {
      const key = filter.dataset.filter;
      local[key] = filter.dataset.value;
      root.querySelector('.filter-side').innerHTML = renderFilters(t);
      fetchHits(true);
      return;
    }
    const sortOption = event.target.closest('[data-action="sort-content"]');
    if (sortOption) { local.sort = sortOption.dataset.value; fetchHits(true); return; }
    if (event.target.closest('[data-action="toggle-content-view"]')) {
      local.view = local.view === 'grid' ? 'list' : 'grid';
      renderResults(false);
      const button = root.querySelector('[data-action="toggle-content-view"]');
      if (button) button.innerHTML = Icon(local.view === 'grid' ? 'layout-grid' : 'list', 'icon-sm');
      return;
    }
    if (event.target.closest('[data-action="clear-content-filters"]')) {
      local.query = ''; local.type = 'modpack'; local.gameVersion = ''; local.loader = ''; local.source = 'modrinth';
      if (search) search.value = '';
      root.querySelector('.filter-side').innerHTML = renderFilters(t);
      fetchHits(true);
      return;
    }
    if (event.target.closest('[data-action="load-more-content"]')) { fetchHits(false); return; }
    const installButton = event.target.closest('[data-action="install-content"]');
    if (installButton) {
      const targetId = root.querySelector('[data-install-target]')?.value || local.targetInstanceId;
      if (!targetId) { showToast(t('noInstancesForInstall'), 'error'); return; }
      const name = installButton.dataset.title || '';
      showToast(t('installingContent').replace('{name}', name));
      const result = await window.prime.content.install({ projectId: installButton.dataset.id, source: installButton.dataset.source, instanceId: targetId });
      if (result?.ok) showToast(t('installedContent').replace('{name}', name));
      else showToast(t('installFailed').replace('{message}', result?.error?.message || t('error')), 'error');
    }
  });
  root.addEventListener('change', (event) => {
    const selectVersion = event.target.closest('[data-filter-select]');
    if (selectVersion) { local.gameVersion = selectVersion.value; fetchHits(true); }
    const target = event.target.closest('[data-install-target]');
    if (target) local.targetInstanceId = target.value;
  });

  return () => {
    clearTimeout(local.searchTimer);
    local.requestId += 1;
    local.loading = false;
    local.root = null;
    local.hits = [];
  };
}

export default { render, mount };
