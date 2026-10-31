import { Icon, escapeHtml } from '../components/ui.js';

const local = { root: null, tab: 'general', settings: null };
const TABS = [
  { id: 'general', key: 'settingsGeneral', icon: 'settings' },
  { id: 'appearance', key: 'settingsAppearance', icon: 'palette' },
  { id: 'java', key: 'settingsJava', icon: 'laptop' },
  { id: 'storage', key: 'settingsStorage', icon: 'archive' },
  { id: 'defaults', key: 'settingsDefaultOptions', icon: 'terminal' },
  { id: 'privacy', key: 'settingsPrivacy', icon: 'shield' },
  { id: 'notifications', key: 'settingsNotifications', icon: 'bell' },
  { id: 'about', key: 'settingsAbout', icon: 'info' }
];
function row(label, control, desc = '') {
  return `<div class="settings-row"><div><strong>${label}</strong>${desc ? `<p class="muted small">${desc}</p>` : ''}</div><div class="settings-control">${control}</div></div>`;
}
function toggle(checked, key) {
  return `<button class="toggle ${checked ? 'on' : ''}" role="switch" aria-checked="${Boolean(checked)}" data-setting-toggle="${escapeHtml(key)}"></button>`;
}
function generalTab(t, s) {
  return `<section class="settings-section">
    ${row(t('language'), `<select class="field" data-setting-field="language"><option value="ar" ${s.language === 'ar' ? 'selected' : ''}>${t('arabic')}</option><option value="en" ${s.language === 'en' ? 'selected' : ''}>${t('english')}</option></select>`)}
    ${row(t('launchOnBoot'), toggle(s.startOnBoot, 'startOnBoot'))}
    ${row(t('startMinimized'), toggle(s.startMinimized, 'startMinimized'))}
    ${row(t('minimizeToTray'), toggle(s.minimizeToTray, 'minimizeToTray'))}
    ${row(t('minimizeOnLaunch'), toggle(s.hideLauncherOnLaunch, 'hideLauncherOnLaunch'))}
  </section>`;
}
function appearanceTab(t, s) {
  const accents = ['nether','red','orange','amber','yellow','lime','green','cyan','blue','purple','pink','custom'];
  return `<section class="settings-section">
    <div class="live-preview card"><div class="preview-titlebar"><img src="../../assets/logo/prime-mark.svg" alt=""><span>Prime Launcher</span></div><div class="preview-body"><div class="preview-sidebar"></div><div class="preview-main"><div class="preview-hero"></div><button class="btn btn-primary btn-sm">${t('launch')}</button></div></div></div>
    ${row(t('theme'), `<div class="chip-row">${['system','light','dark','oled'].map((theme) => `<button class="chip ${s.theme === theme ? 'active' : ''}" data-theme="${theme}">${t(theme)}</button>`).join('')}</div>`)}
    ${row(t('accentColor'), `<div class="accent-row">${accents.map((accent) => `<button class="accent-dot ${s.accent === accent ? 'active' : ''}" data-accent="${accent}" style="--dot:${accent === 'custom' ? (s.customAccent || '#f97316') : ''}" title="${accent}"></button>`).join('')}</div>`)}
    ${row(t('layout'), `<div class="chip-row">${['modern','classic'].map((layout) => `<button class="chip ${s.layout === layout ? 'active' : ''}" data-layout="${layout}">${t(layout)}</button>`).join('')}</div>`)}
  </section>`;
}
async function javaTab(t) {
  let detect = null;
  let runtimes = [];
  try {
    const [detectResult, listResult] = await Promise.all([window.prime.java.detect(), window.prime.java.list()]);
    detect = detectResult?.ok ? detectResult.data : null;
    runtimes = listResult?.ok && Array.isArray(listResult.data) ? listResult.data : [];
  } catch { /* The page still renders an actionable empty state when Java detection fails. */ }
  const runtimeRows = runtimes.map((runtime) => {
    const version = String(runtime.version || '');
    const installed = runtime.status === 'installed';
    const managed = runtime.vendor === 'Temurin' && ['8','16','17','21','25'].includes(version);
    const control = installed
      ? (managed ? `<button class="btn btn-ghost btn-sm" data-java-remove="${escapeHtml(version)}">${t('removeJava')}</button>` : `<span class="badge badge-success">${t('systemJava')}</span>`)
      : `<button class="btn btn-outline btn-sm" data-java-install="${escapeHtml(version)}">${t('installJava')}</button>`;
    return row(`${escapeHtml(runtime.vendor || 'Java')} ${escapeHtml(version)}`, control, runtime.path ? `<span dir="ltr">${escapeHtml(runtime.path)}</span>` : '');
  }).join('');
  return `<section class="settings-section">
    <h4 class="settings-group-title">${t('runtimes')}</h4>
    ${runtimeRows || `<p class="muted">${t('noJavaRuntimes')}</p>`}
    <p class="muted small">${t('platformDetected').replace('{arch}', escapeHtml(detect ? `${detect.platform} ${detect.arch}` : '—'))}</p>
  </section>`;
}
async function storageTab(t) {
  const result = await window.prime.storage.get();
  if (!result?.ok) return `<section class="settings-section">${row(t('storageUsage'), `<span class="muted">${t('error')}</span>`)}</section>`;
  const data = result.data;
  const gb = (value) => (Number(value || 0) / 1073741824).toFixed(1);
  const pct = (value) => Math.min(100, (Number(value || 0) / Math.max(1, Number(data.totalBytes))) * 100);
  return `<section class="settings-section">
    ${row(t('storageDirectory'), `<div class="storage-path"><code dir="ltr">${escapeHtml(data.directory)}</code><button class="btn btn-outline btn-sm" data-action="choose-storage">${t('changeDirectory')}</button></div>`)}
    <div class="storage-bar"><div class="storage-seg instances" style="width:${pct(data.instancesBytes)}%"></div><div class="storage-seg shared" style="width:${pct(data.sharedBytes)}%"></div></div>
    <div class="storage-legend"><span><i class="dot instances"></i>${t('instancesStorage')} ${gb(data.instancesBytes)} GB</span><span><i class="dot shared"></i>${t('sharedStorage')} ${gb(data.sharedBytes)} GB</span><span><i class="dot free"></i>${t('freeStorage')} ${gb(data.freeBytes)} GB</span></div>
  </section>`;
}
function defaultsTab(t) {
  return `<section class="settings-section"><div class="inline-info">${Icon('info')}<p>${t('unsupportedSettingsNote')}</p></div></section>`;
}
function privacyTab(t, s) {
  return `<section class="settings-section">
    ${row(t('usageAnalytics'), toggle(s.analytics, 'analytics'))}
    ${row(t('discordRichPresence'), toggle(s.discordPresence, 'discordPresence'))}
  </section>`;
}
function notificationsTab(t, s) {
  return `<section class="settings-section">
    ${row(t('notifications'), toggle(s.notifications, 'notifications'))}
    ${row(t('notificationSound'), toggle(s.notificationSound, 'notificationSound'))}
  </section>`;
}
function aboutTab(t) {
  return `<section class="settings-section about-section">
    <img class="about-logo" src="../../assets/logo/prime.svg" alt="Prime Launcher">
    ${row(t('aboutVersion'), `<span class="mono">${t('version')}</span>`)}
    ${row(t('buildChannel'), `<span class="badge">${t('buildChannelBeta')}</span>`)}
    ${row(t('operatingSystem'), `<span>${escapeHtml(navigator.platform)}</span>`)}
    ${row(t('architecture'), `<span class="mono">${escapeHtml(navigator.userAgent.includes('Win64') ? 'x64' : '—')}</span>`)}
    ${row(t('checkUpdates'), `<span class="muted small">${t('updateCheckUnavailable')}</span>`)}
    ${row(t('shareLogs'), `<button class="btn btn-outline btn-sm" data-action="share-logs">${Icon('upload', 'icon-sm')}<span>${t('shareLogs')}</span></button>`)}
  </section>`;
}
const renderers = { general: generalTab, appearance: appearanceTab, java: javaTab, storage: storageTab, defaults: defaultsTab, privacy: privacyTab, notifications: notificationsTab, about: aboutTab };

export function render() { return `<div class="page-content settings-page" data-settings-root></div>`; }

export function mount(root, { t, settings, showToast, onSettingsChanged }) {
  local.root = root;
  local.settings = { ...settings };
  let disposed = false;
  async function draw() {
    if (disposed || !local.root) return;
    const tabs = TABS.map((tab) => `<button class="settings-nav-item ${local.tab === tab.id ? 'active' : ''}" data-gstab="${tab.id}">${Icon(tab.icon, 'icon-sm')}<span>${t(tab.key)}</span></button>`).join('');
    const content = await renderers[local.tab](t, local.settings);
    if (disposed || !local.root) return;
    root.innerHTML = `<div class="settings-layout standalone"><aside class="settings-nav"><h3>${t('navSettings')}</h3>${tabs}<div class="settings-nav-footer muted small">${t('settingsNote')}</div></aside><div class="settings-body"><div class="settings-content">${content}</div><footer class="modal-footer"><button class="btn btn-primary" data-action="save-global-settings">${t('saveChanges')}</button></footer></div></div>`;
  }
  async function persist(patch) {
    const result = await window.prime.settings.update(patch);
    if (!result?.ok) { showToast?.(result?.error?.message || t('error'), 'error'); return false; }
    local.settings = result.data;
    await onSettingsChanged?.(result.data);
    showToast?.(t('settingsSaved'));
    await draw();
    return true;
  }
  void draw();
  root.addEventListener('click', async (event) => {
    const tabButton = event.target.closest('[data-gstab]');
    if (tabButton) { local.tab = tabButton.dataset.gstab; await draw(); return; }
    const themeButton = event.target.closest('[data-theme]');
    if (themeButton) { await persist({ theme: themeButton.dataset.theme }); return; }
    const accentButton = event.target.closest('[data-accent]');
    if (accentButton) { await persist({ accent: accentButton.dataset.accent }); return; }
    const layoutButton = event.target.closest('[data-layout]');
    if (layoutButton) { await persist({ layout: layoutButton.dataset.layout }); return; }
    const toggleButton = event.target.closest('[data-setting-toggle]');
    if (toggleButton) {
      const key = toggleButton.dataset.settingToggle;
      await persist({ [key]: !Boolean(local.settings[key]) });
      return;
    }
    const installJavaButton = event.target.closest('[data-java-install]');
    if (installJavaButton) {
      const version = installJavaButton.dataset.javaInstall;
      installJavaButton.disabled = true;
      installJavaButton.textContent = t('javaInstalling');
      const result = await window.prime.java.install({ version });
      if (result?.ok) showToast?.(t('javaInstalled').replace('{version}', version));
      else showToast?.(result?.error?.message || t('javaInstallFailed'), 'error');
      await draw();
      return;
    }
    const removeJavaButton = event.target.closest('[data-java-remove]');
    if (removeJavaButton) {
      const version = removeJavaButton.dataset.javaRemove;
      if (!window.confirm(t('removeJavaConfirm').replace('{version}', version))) return;
      removeJavaButton.disabled = true;
      const result = await window.prime.java.remove({ version });
      if (result?.ok) showToast?.(t('javaRemoved').replace('{version}', version));
      else showToast?.(result?.error?.message || t('javaInstallFailed'), 'error');
      await draw();
      return;
    }
    if (event.target.closest('[data-action="choose-storage"]')) {
      const chosen = await window.prime.storage.chooseDirectory();
      if (chosen?.ok && chosen.data?.directory) await persist({ storageDirectory: chosen.data.directory });
      else if (!chosen?.ok) showToast?.(chosen?.error?.message || t('error'), 'error');
      return;
    }
    if (event.target.closest('[data-action="share-logs"]')) { await window.prime.window.openLogs(); showToast?.(t('logs')); return; }
    if (event.target.closest('[data-action="save-global-settings"]')) {
      const patch = {};
      root.querySelectorAll('[data-setting-field]').forEach((element) => { patch[element.dataset.settingField] = element.value; });
      await persist(patch);
    }
  });
  return () => { disposed = true; local.root = null; };
}
export default { render, mount };
