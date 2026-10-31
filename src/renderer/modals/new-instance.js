import { Icon, escapeHtml } from '../components/ui.js';

let activeCleanup = null;

export function renderNewInstanceModal(t) {
  return `<div class="modal-backdrop" data-modal-backdrop="new-instance"><section class="modal new-instance-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('newInstanceTitle'))}">
    <header class="modal-header"><h2 class="modal-title">${t('newInstanceTitle')}</h2><button class="icon-button" data-action="close-modal" aria-label="${escapeHtml(t('closeModal'))}">${Icon('x')}</button></header>
    <form data-form="new-instance">
      <div class="modal-body new-instance-body">
        <div class="instance-icon-choice"><div class="instance-icon-big">${Icon('grass', 'icon-lg')}</div></div>
        <div class="new-instance-fields">
          <label>${t('instanceName')}<input class="field" name="name" maxlength="40" placeholder="${escapeHtml(t('instanceNamePlaceholder'))}"></label>
          <label>${t('minecraftVersion')}<select class="field" name="version" data-ni-versions disabled><option>${escapeHtml(t('loadingVersions'))}</option></select></label>
          <label class="switch-row"><input type="checkbox" name="showAll" data-ni-show-all><span>${t('showSnapshots')}</span></label>
          <div class="form-field-label">${t('loader')}</div>
          <div class="loader-options">${['vanilla','fabric','forge','neoforge','quilt'].map((loader, i) => `<label class="loader-option ${i === 0 ? 'active' : ''}"><input type="radio" name="loader" value="${loader}" ${i === 0 ? 'checked' : ''}><span>${t(loader)}</span></label>`).join('')}</div>
          <label>${t('loaderVersion')}<select class="field" name="loaderVersion"><option value="">${escapeHtml(t('loaderVersionLatest'))}</option></select></label>
          <label class="switch-row"><input type="checkbox" name="launchAfterInstall"><span>${t('launchAfterInstall')}</span></label>
          <p class="muted small" data-ni-status>${t('loadingVersions')}</p>
        </div>
      </div>
      <footer class="modal-footer"><button class="btn btn-ghost" type="button" data-action="close-modal">${t('cancel')}</button><button class="btn btn-primary" type="submit" data-ni-submit disabled>${Icon('plus')}<span>${t('create')}</span></button></footer>
    </form>
  </section></div>`;
}

export function mountNewInstanceModal(root, { t, onCreated, showToast }) {
  activeCleanup?.();
  const controller = new AbortController();
  activeCleanup = () => controller.abort();
  const { signal } = controller;
  const versionSelect = root.querySelector('[data-ni-versions]');
  const submit = root.querySelector('[data-ni-submit]');
  const status = root.querySelector('[data-ni-status]');
  let showAll = false;
  let requestId = 0;

  async function loadVersions() {
    const current = ++requestId;
    versionSelect.disabled = true;
    submit.disabled = true;
    status.textContent = t('loadingVersions');
    const result = await window.prime.versions.list({ includeSnapshots: showAll, includeOld: showAll, limit: 80 });
    if (current !== requestId || signal.aborted) return;
    if (!result?.ok || !Array.isArray(result.data) || !result.data.length) {
      versionSelect.innerHTML = `<option value="">${escapeHtml(t('versionsLoadFailed'))}</option>`;
      status.textContent = t('versionsLoadFailed');
      showToast?.(result?.error?.message || t('versionsLoadFailed'), 'error');
      return;
    }
    const versions = result.data;
    const latestRelease = versions.find((version) => version.type === 'release')?.id || versions[0].id;
    versionSelect.innerHTML = versions.map((version) => `<option value="${escapeHtml(version.id)}" ${version.id === latestRelease ? 'selected' : ''}>${escapeHtml(version.id)}${version.type !== 'release' ? ` (${escapeHtml(version.type)})` : ''}</option>`).join('');
    versionSelect.disabled = false;
    submit.disabled = false;
    status.textContent = t('versionsLoaded').replace('{count}', String(versions.length));
  }

  root.addEventListener('change', (event) => {
    if (event.target.matches('[data-ni-show-all]')) { showAll = event.target.checked; loadVersions(); }
    if (event.target.name === 'loader') root.querySelectorAll('.loader-option').forEach((label) => label.classList.toggle('active', label.querySelector('input') === event.target));
  }, { signal });

  root.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-form="new-instance"]');
    if (!form) return;
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    const fd = new FormData(form);
    const result = await window.prime.instances.create({
      name: fd.get('name')?.toString().trim() || undefined,
      version: fd.get('version')?.toString() || undefined,
      loader: fd.get('loader')?.toString() || 'vanilla',
      loaderVersion: fd.get('loaderVersion')?.toString() || undefined,
      launchAfterInstall: fd.get('launchAfterInstall') === 'on'
    });
    if (result?.ok) {
      showToast?.(t('instanceCreated'));
      root.innerHTML = '';
      controller.abort();
      activeCleanup = null;
      await onCreated?.(result.data);
    } else {
      showToast?.(result?.error?.message || t('error'), 'error');
      submit.disabled = false;
    }
  }, { signal });

  loadVersions();
  return () => {
    controller.abort();
    if (activeCleanup) activeCleanup = null;
    requestId += 1;
  };
}

export function cleanupNewInstanceModal() {
  activeCleanup?.();
  activeCleanup = null;
}
