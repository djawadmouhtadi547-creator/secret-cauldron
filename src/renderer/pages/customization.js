import { Icon, Button, escapeHtml } from '../components/ui.js';

const local = { t: null, root: null, skin: null, viewer: null };

function vendorAvailable() {
  const library = window.skinview3d || window.SkinView3D;
  return Boolean(library && typeof library.SkinViewer === 'function');
}

async function loadSkin() {
  if (!local.root) return;
  try {
    const result = await window.prime.skins.get();
    if (result?.ok) local.skin = result.data;
  } catch { /* Keep the previous preview data when the local service is unavailable. */ }
  renderPreview();
}

function renderPreview() {
  const t = local.t;
  const wrap = local.root?.querySelector('[data-skin-viewer]');
  if (!wrap) return;
  local.viewer?.dispose?.();
  local.viewer = null;
  if (!vendorAvailable()) {
    wrap.innerHTML = `${local.skin?.skinUrl ? `<img class="skin-2d-preview" src="${escapeHtml(local.skin.skinUrl)}" alt="${escapeHtml(t('skinPreview'))}">` : ''}<div class="skin-fallback">${Icon('user', 'icon-lg')}<span>${escapeHtml(t('skinViewerUnavailable'))}</span></div>`;
    return;
  }
  try {
    wrap.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 300;
    wrap.append(canvas);
    const library = window.skinview3d || window.SkinView3D;
    const viewer = new library.SkinViewer({ canvas, width: 240, height: 300 });
    if (local.skin?.skinUrl) viewer.loadSkin(local.skin.skinUrl);
    if (local.skin?.capeUrl) viewer.loadCape(local.skin.capeUrl);
    viewer.controls.enableRotate = true;
    viewer.controls.enableZoom = false;
    local.viewer = viewer;
  } catch {
    wrap.innerHTML = `<div class="skin-fallback">${Icon('user', 'icon-lg')}<span>${escapeHtml(t('skinViewerUnavailable'))}</span></div>`;
  }
}

export function render(t) {
  local.t = t;
  return `<div class="page-content customization-page">
    <header class="page-header"><div><h1 class="page-title">${t('customizationTitle')}</h1><p class="page-subtitle">${t('customizationSubtitle')}</p></div>
      <a class="btn btn-outline" href="https://www.minecraftskins.com/" target="_blank" rel="noreferrer">${Icon('external-link', 'icon-sm')}<span>${t('discoverSkins')}</span></a></header>
    <div class="customization-layout">
      <section class="card skin-preview-card"><div class="section-heading"><h2>${t('skinPreview')}</h2><span class="muted">${t('rotateHint')}</span></div><div class="skin-viewer" data-skin-viewer></div></section>
      <section class="card skin-info-card"><div class="section-heading"><h2>${t('accountType')}</h2></div>
        <p class="muted">${t('skinEditNote')}</p><div class="sidebar-separator"></div><p class="muted">${t('offlineSkinNote')}</p>
        <div class="skin-actions">${Button({ label: t('chooseSkinFile'), icon: 'upload', variant: 'primary', action: 'choose-skin-file' })}
          <div class="field-wrap"><input class="field" data-skin-url placeholder="${escapeHtml(t('skinUrlPlaceholder'))}" dir="ltr"></div>
          ${Button({ label: t('applySkinUrl'), icon: 'check', variant: 'outline', action: 'apply-skin-url' })}
        </div><p class="muted small">${t('skinServerInfo')}</p>
      </section>
    </div>
  </div>`;
}

export function mount(root, { t, showToast }) {
  local.root = root;
  local.t = t;
  void loadSkin();
  root.addEventListener('click', async (event) => {
    if (event.target.closest('[data-action="choose-skin-file"]')) {
      const picked = await window.prime.skins.selectFile();
      if (!picked?.ok || !picked.data?.filePath) return;
      const applied = await window.prime.skins.applyOffline({ filePath: picked.data.filePath });
      if (applied?.ok) { showToast(t('skinApplied')); await loadSkin(); }
      else showToast(t('skinApplyFailed').replace('{message}', applied?.error?.message || t('error')), 'error');
      return;
    }
    if (event.target.closest('[data-action="apply-skin-url"]')) {
      const url = root.querySelector('[data-skin-url]')?.value.trim();
      if (!url) return;
      const applied = await window.prime.skins.applyOffline({ url });
      if (applied?.ok) { showToast(t('skinApplied')); await loadSkin(); }
      else showToast(t('skinApplyFailed').replace('{message}', applied?.error?.message || t('error')), 'error');
    }
  });
  return () => {
    local.viewer?.dispose?.();
    local.viewer = null;
    local.root = null;
  };
}

export default { render, mount };
