import { Icon, escapeHtml } from '../components/ui.js';

const TABS = [
  { id: 'general', key: 'tabGeneral', icon: 'settings' },
  { id: 'installation', key: 'tabInstallation', icon: 'download' },
  { id: 'window', key: 'tabWindow', icon: 'monitor' },
  { id: 'controls', key: 'tabControls', icon: 'keyboard' },
  { id: 'java', key: 'tabJava', icon: 'laptop' },
  { id: 'hooks', key: 'tabHooks', icon: 'terminal' },
  { id: 'legacy', key: 'tabLegacy', icon: 'shield' }
];
const KEYS = [
  ['key_key.forward', 'W', 'controlForward'], ['key_key.back', 'S', 'controlBack'], ['key_key.left', 'A', 'controlLeft'], ['key_key.right', 'D', 'controlRight'], ['key_key.jump', 'Space', 'controlJump'],
  ['key_key.sprint', 'Left Control', 'controlSprint'], ['key_key.sneak', 'Left Shift', 'controlSneak'], ['key_key.drop', 'Q', 'controlDrop'], ['key_key.inventory', 'E', 'controlInventory']
];
const state = { tab: 'general', instance: null, originalInstance: null, options: {}, root: null, busy: false };

function row(label, control, desc = '') {
  return `<div class="settings-row"><div><strong>${label}</strong>${desc ? `<p class="muted small">${desc}</p>` : ''}</div><div class="settings-control">${control}</div></div>`;
}
function optionToggle(t, key, label) {
  const enabled = state.options[key] === 'true';
  return row(label, `<button class="toggle ${enabled ? 'on' : ''}" role="switch" aria-checked="${enabled}" data-option-toggle="${key}"></button>`);
}
function generalTab(t) {
  const instance = state.instance;
  return `<section class="settings-section">
    ${row(t('instanceName'), `<input class="field" data-instance-field="name" maxlength="60" value="${escapeHtml(instance.name)}">`)}
    ${instance.linkedPack ? `<div class="linked-pack"><span class="badge">${Icon('package', 'icon-sm')} ${escapeHtml(instance.linkedPack.name)}</span><span class="muted">${escapeHtml(instance.linkedPack.source)}</span></div>` : ''}
    <div class="inline-info">${Icon('info')}<p>${t('instanceOptionsNote')}</p></div>
  </section>`;
}
function installationTab(t) {
  const instance = state.instance;
  return `<section class="settings-section">
    ${instance.linkedPack ? `<div class="warning-banner">${Icon('alert-circle', 'icon-sm')}<span>${t('installationLocked')}</span></div>` : ''}
    ${row(t('minecraftVersion'), `<input class="field" data-instance-field="version" value="${escapeHtml(instance.version)}" ${instance.linkedPack ? 'disabled' : ''} dir="ltr">`)}
    ${row(t('loader'), `<select class="field" data-instance-field="loader" ${instance.linkedPack ? 'disabled' : ''}>${['vanilla','fabric','forge','neoforge','quilt'].map((loader) => `<option value="${loader}" ${instance.loader === loader ? 'selected' : ''}>${t(loader)}</option>`).join('')}</select>`)}
    ${row(t('loaderVersion'), `<input class="field" data-instance-field="loaderVersion" value="${escapeHtml(instance.loaderVersion || '')}" ${instance.linkedPack ? 'disabled' : ''} dir="ltr">`)}
    <p class="muted small">${t('installationChangeNote')}</p>
  </section>`;
}
function windowTab(t) {
  const width = state.options.overrideWidth || '';
  const height = state.options.overrideHeight || '';
  return `<section class="settings-section">
    ${optionToggle(t, 'fullscreen', t('fullscreen'))}
    ${row(t('windowResolution'), `<div class="resolution-fields"><input class="field" type="number" min="640" max="7680" placeholder="${t('width')}" data-option-field="overrideWidth" value="${escapeHtml(width)}"><span>×</span><input class="field" type="number" min="360" max="4320" placeholder="${t('height')}" data-option-field="overrideHeight" value="${escapeHtml(height)}"></div>`)}
    <p class="muted small">${t('gameOptionsSavedNote')}</p>
  </section>`;
}
function controlsTab(t) {
  const controls = KEYS.map(([key, fallback, label]) => row(t(label), `<button class="key-cap" data-key-name="${key}">${escapeHtml(state.options[key] || fallback)}</button>`)).join('');
  return `<section class="settings-section"><div class="content-toolbar"><div class="field-wrap has-icon"><span class="field-icon">${Icon('search', 'icon-sm')}</span><input class="field" data-controls-search placeholder="${escapeHtml(t('searchControls'))}"></div><button class="btn btn-ghost btn-sm" data-action="reset-controls">${t('resetAllControls')}</button></div>${controls}</section>`;
}
function javaTab(t) {
  const memory = state.options.memoryAllocation || 'auto';
  return `<section class="settings-section">
    ${row(t('memoryAllocation'), `<select class="field" data-option-field="memoryAllocation">${['auto','1024','2048','3072','4096','6144','8192'].map((value) => `<option value="${value}" ${memory === value ? 'selected' : ''}>${value === 'auto' ? t('memoryAuto') : `${value} MB`}</option>`).join('')}</select>`, t('memoryAllocationNote'))}
    ${row(t('customJavaPath'), `<input class="field" data-option-field="javaPath" dir="ltr" placeholder="${escapeHtml(t('javaAuto'))}" value="${escapeHtml(state.options.javaPath || '')}">`, t('javaPathNote'))}
    ${row(t('jvmArguments'), `<textarea class="field mono" data-option-field="jvmArgs" rows="4" dir="ltr" placeholder="-XX:+UseG1GC">${escapeHtml(state.options.jvmArgs || '')}</textarea>`, t('jvmArgumentsNote'))}
  </section>`;
}
function unavailableTab(t) {
  return `<section class="settings-section"><div class="inline-info">${Icon('info')}<p>${t('unsupportedSettingsNote')}</p></div></section>`;
}
const tabRenderers = { general: generalTab, installation: installationTab, window: windowTab, controls: controlsTab, java: javaTab, hooks: unavailableTab, legacy: unavailableTab };

export function renderInstanceSettingsModal(t, instance) {
  state.tab = 'general';
  state.instance = { ...instance };
  state.originalInstance = { ...instance };
  return `<div class="modal-backdrop" data-modal-backdrop="instance-settings"><section class="modal settings-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(t('instanceSettingsTitle'))}"><div class="settings-layout"><aside class="settings-nav"><h3>${t('instanceSettingsTitle')}</h3>${TABS.map((tab) => `<button class="settings-nav-item ${tab.id === state.tab ? 'active' : ''}" data-istab="${tab.id}">${Icon(tab.icon, 'icon-sm')}<span>${t(tab.key)}</span></button>`).join('')}<div class="settings-nav-footer muted mono">${escapeHtml(instance.version)} / ${escapeHtml(instance.loader)}</div></aside><div class="settings-body"><div class="settings-content" data-settings-content><div class="muted">${t('loading')}</div></div><footer class="modal-footer"><button class="btn btn-ghost" data-action="close-modal">${t('cancel')}</button><button class="btn btn-primary" data-action="save-instance-settings">${t('saveChanges')}</button></footer></div></div></section></div>`;
}

export function mountInstanceSettingsModal(root, { t, instanceId, showToast, onSaved }) {
  state.root = root;
  state.options = {};
  let disposed = false;
  let captureHandler = null;
  function draw() {
    if (disposed) return;
    root.querySelectorAll('[data-istab]').forEach((button) => button.classList.toggle('active', button.dataset.istab === state.tab));
    const content = root.querySelector('[data-settings-content]');
    if (content) content.innerHTML = tabRenderers[state.tab](t);
  }
  window.prime.instances.getOptions({ id: instanceId }).then((result) => {
    if (disposed) return;
    if (result?.ok && result.data && typeof result.data === 'object') state.options = result.data;
    draw();
  }).catch(() => draw());
  root.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-istab]');
    if (tabButton) {
      root.querySelectorAll('[data-instance-field]').forEach((field) => { state.instance[field.dataset.instanceField] = field.value; });
      root.querySelectorAll('[data-option-field]').forEach((field) => { state.options[field.dataset.optionField] = field.value; });
      state.tab = tabButton.dataset.istab; draw(); return;
    }
    const toggle = event.target.closest('[data-option-toggle]');
    if (toggle) {
      const key = toggle.dataset.optionToggle;
      state.options[key] = state.options[key] === 'true' ? 'false' : 'true';
      toggle.classList.toggle('on', state.options[key] === 'true');
      toggle.setAttribute('aria-checked', String(state.options[key] === 'true'));
      return;
    }
    const keyButton = event.target.closest('[data-key-name]');
    if (keyButton) {
      if (captureHandler) document.removeEventListener('keydown', captureHandler, true);
      keyButton.textContent = t('pressAnyKey');
      captureHandler = (keyEvent) => {
        keyEvent.preventDefault(); keyEvent.stopPropagation();
        const key = keyEvent.key === ' ' ? 'space' : keyEvent.key.toLowerCase();
        state.options[keyButton.dataset.keyName] = `key.keyboard.${key}`;
        keyButton.textContent = keyEvent.key === ' ' ? 'Space' : keyEvent.key;
        document.removeEventListener('keydown', captureHandler, true); captureHandler = null;
      };
      document.addEventListener('keydown', captureHandler, true);
      return;
    }
    if (event.target.closest('[data-action="reset-controls"]')) {
      for (const [key, value] of KEYS) {
        const normalized = value === 'Space' ? 'space' : value === 'Left Control' ? 'left.control' : value === 'Left Shift' ? 'left.shift' : value.toLowerCase();
        state.options[key] = `key.keyboard.${normalized}`;
      }
      draw(); return;
    }
    if (event.target.closest('[data-action="save-instance-settings"]')) {
      const button = event.target.closest('[data-action="save-instance-settings"]');
      if (state.busy) return;
      state.busy = true; button.disabled = true;
      try {
        const patch = {};
        root.querySelectorAll('[data-instance-field]').forEach((field) => { state.instance[field.dataset.instanceField] = field.value; });
        for (const key of ['name', 'version', 'loader', 'loaderVersion']) {
          if (state.instance[key] !== (state.originalInstance[key] ?? '')) patch[key] = state.instance[key] === '' && key === 'loaderVersion' ? null : state.instance[key];
        }
        const width = root.querySelector('[data-option-field="overrideWidth"]')?.value.trim();
        const height = root.querySelector('[data-option-field="overrideHeight"]')?.value.trim();
        if (width) state.options.overrideWidth = width;
        else delete state.options.overrideWidth;
        if (height) state.options.overrideHeight = height;
        else delete state.options.overrideHeight;
        if (Object.keys(patch).length) {
          const update = await window.prime.instances.update({ id: instanceId, patch });
          if (!update?.ok) throw new Error(update?.error?.message || t('error'));
        }
        const options = await window.prime.instances.updateOptions({ id: instanceId, patch: state.options });
        if (!options?.ok) throw new Error(options?.error?.message || t('error'));
        showToast(t('changesSaved'));
        root.innerHTML = '';
        await onSaved?.();
      } catch (error) {
        showToast(error.message || t('error'), 'error');
        button.disabled = false;
      } finally { state.busy = false; }
    }
  });
  root.addEventListener('input', (event) => {
    if (event.target.matches('[data-option-field]')) state.options[event.target.dataset.optionField] = event.target.value;
    if (event.target.matches('[data-controls-search]')) {
      const query = event.target.value.toLowerCase();
      root.querySelectorAll('.settings-row').forEach((item) => { item.hidden = !item.textContent.toLowerCase().includes(query); });
    }
  });
  return () => {
    disposed = true;
    if (captureHandler) document.removeEventListener('keydown', captureHandler, true);
    state.root = null;
  };
}
