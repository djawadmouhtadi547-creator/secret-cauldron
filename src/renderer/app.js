import { renderWelcome } from './pages/welcome.js';
import { renderDashboard, renderNewsPanel } from './pages/dashboard.js';
import contentHubPage from './pages/content-hub.js';
import serversPage from './pages/servers.js';
import customizationPage from './pages/customization.js';
import libraryPage from './pages/library.js';
import instancePage from './pages/instance.js';
import settingsPage from './pages/settings.js';
import { renderAccountMenu } from './components/account-menu.js';
import { renderNewInstanceModal, mountNewInstanceModal, cleanupNewInstanceModal } from './modals/new-instance.js';
import { Icon, Toast, ContextMenu, escapeHtml } from './components/ui.js';
import arDictionary from './i18n/ar.json' with { type: 'json' };
import enDictionary from './i18n/en.json' with { type: 'json' };

const appRoot = document.getElementById('app');
const overlayRoot = document.getElementById('overlay-root');
const toastRoot = document.getElementById('toast-root');
const dictionaries = { ar: arDictionary, en: enDictionary };
let pageCleanup = null;
let modalCleanup = null;
let currentInstanceId = null;

const state = {
  locale: 'ar', settings: null, accounts: [], account: null, instances: [], news: [], projects: [], servers: [], playtime: null,
  route: 'dashboard', welcomeMode: 'choose', welcomeDismissed: false, addingAccount: false,
  accountMenuOpen: false, modal: '', contextMenuInstance: null
};

async function loadDictionary(locale) {
  return dictionaries[locale] || dictionaries.ar;
}

let dictionary = await loadDictionary(state.locale);
function t(key, values = {}) {
  let text = dictionary[key] ?? key;
  for (const [name, value] of Object.entries(values)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

function applyPreferences() {
  document.documentElement.lang = state.locale;
  document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dataset.theme = state.settings?.theme || 'oled';
  document.documentElement.dataset.accent = state.settings?.accent || 'nether';
  document.documentElement.style.setProperty('--custom-accent', state.settings?.customAccent || '#f97316');
  document.body.classList.toggle('layout-classic', state.settings?.layout === 'classic');
}

async function api(promise, quiet = false) {
  try {
    const result = await promise;
    if (!result?.ok) {
      if (!quiet) showToast(t(`apiError${result?.error?.code ? result.error.code : 'Generic'}`) || t('apiErrorGeneric'), 'error');
      return null;
    }
    return result.data;
  } catch (error) {
    if (!quiet) showToast(t('apiErrorGeneric'), 'error');
    return null;
  }
}

function showToast(message, tone = 'success') {
  const temporary = document.createElement('div');
  temporary.innerHTML = Toast(message, tone);
  const toast = temporary.firstElementChild;
  toastRoot.append(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function notifyLaunchResult(result) {
  if (!result) return;
  showToast(result.status === 'mock' ? t('launchMock') : t('launchStarted'));
}

async function loadCoreData() {
  const [settings, accounts, instances, news, projectsResult, serversResult, playtime] = await Promise.all([
    api(window.prime.settings.get(), true), api(window.prime.accounts.list(), true), api(window.prime.instances.list(), true),
    api(window.prime.news.list(), true), api(window.prime.content.search({ source: 'modrinth', type: 'mod', sort: 'downloads', limit: 3 }), true),
    api(window.prime.servers.list({ sort: 'players' }), true), api(window.prime.playtime.summary(), true)
  ]);
  state.settings = settings || { theme: 'oled', accent: 'nether', layout: 'modern', language: 'ar' };
  state.locale = state.settings.language === 'en' ? 'en' : 'ar';
  dictionary = await loadDictionary(state.locale);
  state.accounts = accounts || [];
  state.account = state.accounts.find((account) => account.active) || state.accounts[0] || null;
  state.instances = instances || [];
  state.news = news || [];
  state.projects = projectsResult?.hits || [];
  state.servers = serversResult?.servers || [];
  state.playtime = playtime;
  applyPreferences();
}

function renderTitlebar() {
  return `<header class="titlebar">
    <div class="titlebar-start"><div class="titlebar-brand"><img src="../../assets/logo/prime-mark.svg" alt=""><span>Prime Launcher</span><span class="badge">${t('version')}</span><span class="badge">${t('beta')}</span></div></div>
    <div class="titlebar-end">
      <div class="titlebar-actions"><button data-action="open-logs" title="${t('logs')}" aria-label="${t('logs')}">${Icon('bug', 'icon-sm')}</button><button data-action="support-info" title="${t('support')}" aria-label="${t('support')}">${Icon('heart', 'icon-sm')}</button><button data-action="toggle-language" title="${t('changeLanguage')}" aria-label="${t('changeLanguage')}"><span class="language-indicator">${state.locale.toUpperCase()}</span></button></div>
      <div class="window-controls"><button data-action="minimize-window" title="${t('minimize')}" aria-label="${t('minimize')}">${Icon('minus', 'icon-sm')}</button><button data-action="maximize-window" title="${t('maximize')}" aria-label="${t('maximize')}">${Icon('square', 'icon-sm')}</button><button data-action="close-window" class="close-window" title="${t('close')}" aria-label="${t('close')}">${Icon('x', 'icon-sm')}</button></div>
    </div>
  </header>`;
}

const navItems = [
  ['dashboard', 'navDashboard', 'dashboard'], ['content', 'navContent', 'cubes'], ['servers', 'navServers', 'globe'],
  ['customization', 'navCustomization', 'tshirt'], ['library', 'navLibrary', 'archive']
];

function renderSidebar() {
  const shortcuts = state.instances.map((instance) => `<button class="instance-shortcut has-tooltip" data-action="play-instance" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(instance.name)}">${Icon(instance.icon || 'grass')}<span class="tooltip">${escapeHtml(instance.name)}</span></button>`).join('');
  const navigation = navItems.map(([route, label, icon]) => `<button class="nav-item has-tooltip ${state.route === route ? 'active' : ''}" data-route="${route}" data-label="${t(label)}" aria-label="${t(label)}">${Icon(icon)}<span class="tooltip">${t(label)}</span></button>`).join('');
  return `<aside class="panel sidebar">
    <button class="avatar-button" data-action="toggle-account-menu" aria-label="${t('accountMenu')}">${state.account ? Icon('user') : Icon('user')}<i class="connected-dot"></i></button>
    <div class="sidebar-separator"></div>
    <nav class="sidebar-nav">${navigation}</nav>
    <div class="sidebar-separator"></div>
    <button class="sidebar-action has-tooltip" data-action="new-instance" aria-label="${t('newInstance')}">${Icon('plus')}<span class="tooltip">${t('newInstance')}</span></button>
    <div class="sidebar-separator"></div>
    <div class="instance-shortcuts">${shortcuts}</div>
    ${state.instances.length > 5 ? `<button class="sidebar-chevron" data-action="scroll-instances" aria-label="${t('moreInstances')}">${Icon('chevron-down', 'icon-sm')}</button>` : ''}
    <div class="sidebar-bottom"><div class="sidebar-separator"></div><button class="sidebar-action has-tooltip ${state.route === 'settings' ? 'active' : ''}" data-route="settings" aria-label="${t('navSettings')}">${Icon('settings')}<span class="tooltip">${t('navSettings')}</span></button></div>
  </aside>`;
}

function renderMainPage() {
  if (state.route === 'dashboard') return renderDashboard({ t, account: state.account, instances: state.instances, projects: state.projects, servers: state.servers, news: state.news, playtime: state.playtime });
  const pages = { content: contentHubPage.render, servers: serversPage.render, customization: customizationPage.render, library: libraryPage.render, instance: instancePage.render, settings: settingsPage.render };
  return (pages[state.route] || settingsPage.render)(t);
}

function mountCurrentPage() {
  const root = appRoot.querySelector('.main-panel');
  if (!root || state.route === 'dashboard') return;
  const options = {
    t, instances: state.instances, settings: state.settings, showToast, refreshInstances,
    openInstanceSettings: (id) => { void openInstanceSettings(id); },
    onJoinServer: (address) => { void joinServer(address); },
    onSettingsChanged: async (updated) => {
      state.settings = updated || state.settings;
      state.locale = state.settings?.language === 'en' ? 'en' : 'ar';
      dictionary = await loadDictionary(state.locale);
      applyPreferences();
      render();
    }
  };
  const mounts = {
    content: contentHubPage.mount, servers: serversPage.mount, customization: customizationPage.mount,
    library: libraryPage.mount, instance: (element, opts) => instancePage.mount(element, { ...opts, instanceId: currentInstanceId }),
    settings: settingsPage.mount
  };
  if (mounts[state.route]) pageCleanup = mounts[state.route](root, options) || null;
}

function renderShell() {
  pageCleanup?.();
  pageCleanup = null;
  const classic = state.settings?.layout === 'classic' ? 'layout-classic' : '';
  appRoot.innerHTML = `${renderTitlebar()}<div class="app-shell ${classic}">${renderSidebar()}<main class="panel main-panel">${renderMainPage()}</main><aside class="panel side-panel">${renderNewsPanel({ t, news: state.news })}</aside></div>`;
  overlayRoot.innerHTML = state.accountMenuOpen ? renderAccountMenu({ t, account: state.account, accounts: state.accounts }) : '';
  const popover = overlayRoot.querySelector('[data-account-popover]');
  if (popover) popover.hidden = false;
  mountCurrentPage();
}

function renderWelcomeScreen() {
  pageCleanup?.();
  pageCleanup = null;
  modalCleanup?.(); modalCleanup = null;
  cleanupNewInstanceModal();
  appRoot.innerHTML = `${renderTitlebar()}${renderWelcome(t, state.welcomeMode, state.welcomeDismissed)}`;
  overlayRoot.innerHTML = '';
  const input = appRoot.querySelector('#offline-username');
  if (input) {
    const submit = appRoot.querySelector('.offline-submit');
    input.addEventListener('input', () => {
      submit.disabled = !/^[a-zA-Z0-9_]{3,16}$/.test(input.value);
    });
    input.focus();
  }
}

function render() {
  applyPreferences();
  if (state.account && !state.addingAccount) renderShell();
  else renderWelcomeScreen();
}

async function refreshAccounts() {
  state.accounts = await api(window.prime.accounts.list(), true) || [];
  state.account = state.accounts.find((account) => account.active) || state.accounts[0] || null;
}
async function refreshInstances() {
  state.instances = await api(window.prime.instances.list(), true) || [];
  return state.instances;
}

async function addOfflineAccount(username) {
  const result = await api(window.prime.accounts.addOffline({ username }));
  if (!result) return;
  await refreshAccounts();
  state.addingAccount = false;
  state.welcomeDismissed = false;
  state.route = 'dashboard';
  showToast(t('accountAdded'));
  render();
}

async function handleMicrosoftLogin() {
  const result = await api(window.prime.accounts.beginMicrosoftLogin());
  if (!result) return;
  showInfoModal(result.status === 'unsupported' ? t('microsoftUnsupported') : t('microsoftNotConfigured'));
}

function showInfoModal(message) {
  modalCleanup?.(); modalCleanup = null;
  cleanupNewInstanceModal();
  overlayRoot.innerHTML = `<div class="modal-backdrop" data-modal-backdrop="info"><section class="modal" role="dialog" aria-modal="true"><header class="modal-header"><h2 class="modal-title">${t('microsoftSetupTitle')}</h2><button class="icon-button" data-action="close-modal" aria-label="${t('closeModal')}">${Icon('x')}</button></header><div class="modal-body"><div class="inline-info">${Icon('info')}<p>${escapeHtml(message)}</p></div></div><footer class="modal-footer"><button class="btn btn-primary" data-action="close-modal">${t('dismiss')}</button></footer></section></div>`;
}

function showNewInstanceModal() {
  modalCleanup?.(); modalCleanup = null;
  cleanupNewInstanceModal();
  state.modal = 'new-instance';
  overlayRoot.innerHTML = renderNewInstanceModal(t);
  modalCleanup = mountNewInstanceModal(overlayRoot, {
    t, showToast,
    onCreated: async () => { modalCleanup?.(); modalCleanup = null; await refreshInstances(); state.modal = ''; render(); }
  });
}

async function openInstanceSettings(instanceId) {
  if (!instanceId) return;
  currentInstanceId = instanceId;
  state.route = 'instance';
  state.accountMenuOpen = false;
  render();
  const instance = await api(window.prime.instances.get({ id: instanceId }), true);
  if (!instance) { showToast(t('instanceNotFound'), 'error'); return; }
  const module = await import('./modals/instance-settings.js');
  modalCleanup?.(); modalCleanup = null;
  overlayRoot.innerHTML = module.renderInstanceSettingsModal(t, instance);
  modalCleanup = module.mountInstanceSettingsModal(overlayRoot, {
    t, instanceId, showToast,
    onSaved: async () => { modalCleanup?.(); modalCleanup = null; await refreshInstances(); render(); }
  });
}

async function joinServer(address) {
  if (!state.instances.length) { showToast(t('noInstancesForJoin'), 'error'); return; }
  const target = state.instances.find((instance) => instance.status === 'ready') || state.instances[0];
  const result = await api(window.prime.launch.start({ instanceId: target.id, serverAddress: address }));
  notifyLaunchResult(result);
}

function showContextMenu(x, y, instanceId) {
  state.contextMenuInstance = instanceId;
  const actions = [
    { label: t('launch'), icon: 'play', action: 'play-instance', id: instanceId },
    { label: t('duplicateInstance'), icon: 'copy', action: 'duplicate-instance', id: instanceId },
    { label: t('openFolder'), icon: 'folder', action: 'open-instance-folder', id: instanceId },
    { label: t('openSettings'), icon: 'settings', action: 'open-instance-settings', id: instanceId },
    { label: t('deleteInstance'), icon: 'trash-2', action: 'delete-instance', id: instanceId }
  ];
  overlayRoot.innerHTML = ContextMenu(actions);
  const menu = overlayRoot.querySelector('.context-menu');
  menu.hidden = false;
  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 150)}px`;
}

async function handleAction(action, element) {
  switch (action) {
    case 'toggle-language': {
      state.locale = state.locale === 'ar' ? 'en' : 'ar';
      dictionary = await loadDictionary(state.locale);
      state.settings = await api(window.prime.settings.update({ language: state.locale }), true) || { ...state.settings, language: state.locale };
      render();
      showToast(t('languageChanged'));
      break;
    }
    case 'minimize-window': await api(window.prime.window.minimize(), true); break;
    case 'maximize-window': await api(window.prime.window.toggleMaximize(), true); break;
    case 'close-window': await api(window.prime.window.close(), true); break;
    case 'open-logs': await api(window.prime.window.openLogs(), true); showToast(t('logs')); break;
    case 'support-info': showToast(t('supportNotice'), 'success'); break;
    case 'open-dropdown': { const menu = element.parentElement.querySelector('.dropdown-menu'); if (menu) { menu.hidden = !menu.hidden; element.setAttribute('aria-expanded', String(!menu.hidden)); } break; }
    case 'scroll-instances': appRoot.querySelector('.instance-shortcuts')?.scrollBy({ top: 180, behavior: 'smooth' }); break;
    case 'toggle-setting': { const key = element.dataset.setting; if (key && state.settings && typeof state.settings[key] === 'boolean') { const next = !state.settings[key]; const saved = await api(window.prime.settings.update({ [key]: next }), true); if (saved) { state.settings = saved; render(); showToast(t('settingsSaved')); } } break; }
    case 'toggle-account-menu': state.accountMenuOpen = !state.accountMenuOpen; render(); break;
    case 'add-account': state.accountMenuOpen = false; state.addingAccount = true; state.welcomeMode = 'choose'; state.welcomeDismissed = false; render(); break;
    case 'switch-account': {
      await api(window.prime.accounts.switch({ id: element.dataset.id }));
      await refreshAccounts(); state.accountMenuOpen = false; render(); break;
    }
    case 'logout-account': {
      await api(window.prime.accounts.logout({ id: element.dataset.id }));
      await refreshAccounts(); state.accountMenuOpen = false; state.route = 'dashboard'; render(); break;
    }
    case 'microsoft-login': await handleMicrosoftLogin(); break;
    case 'offline-login': state.welcomeMode = 'offline'; render(); break;
    case 'welcome-back': state.welcomeMode = 'choose'; render(); break;
    case 'close-welcome': state.welcomeDismissed = true; render(); break;
    case 'reopen-welcome': state.welcomeDismissed = false; state.welcomeMode = 'choose'; render(); break;
    case 'new-instance': state.accountMenuOpen = false; showNewInstanceModal(); break;
    case 'close-modal': modalCleanup?.(); modalCleanup = null; cleanupNewInstanceModal(); overlayRoot.innerHTML = ''; state.modal = ''; break;
    case 'refresh-news': state.news = await api(window.prime.news.refresh(), true) || state.news; render(); showToast(t('success')); break;
    case 'support': showToast(t('supportNotice')); break;
    case 'play-instance': {
      const instanceId = element.dataset.id;
      const result = await api(window.prime.launch.start({ instanceId }));
      notifyLaunchResult(result);
      break;
    }
    case 'open-instance-folder': {
      const result = await api(window.prime.instances.openFolder({ id: element.dataset.id }));
      if (result) showToast(t('openFolder'));
      overlayRoot.innerHTML = '';
      break;
    }
    case 'open-instance-settings': await openInstanceSettings(element.dataset.id); break;
    case 'duplicate-instance': {
      const duplicated = await api(window.prime.instances.duplicate({ id: element.dataset.id }));
      overlayRoot.innerHTML = '';
      if (duplicated) { await refreshInstances(); render(); showToast(t('instanceDuplicated')); }
      break;
    }
    case 'delete-instance': {
      const instance = state.instances.find((item) => item.id === element.dataset.id);
      const message = t('deleteConfirmBody').replace('{name}', instance?.name || '');
      if (window.confirm(message)) {
        const deleted = await api(window.prime.instances.delete({ id: element.dataset.id }));
        if (deleted) { overlayRoot.innerHTML = ''; await refreshInstances(); render(); showToast(t('instanceDeleted')); }
      } else overlayRoot.innerHTML = '';
      break;
    }
    default: break;
  }
}

appRoot.addEventListener('click', async (event) => {
  const tabButton = event.target.closest('[data-tab]');
  if (tabButton) {
    const tabBar = tabButton.closest('.tabs');
    tabBar?.querySelectorAll('[data-tab]').forEach((tab) => { const active = tab === tabButton; tab.classList.toggle('active', active); tab.setAttribute('aria-selected', String(active)); });
    return;
  }
  const chipButton = event.target.closest('[data-chip]');
  if (chipButton) { chipButton.classList.toggle('active'); return; }
  const dropdownOption = event.target.closest('[data-dropdown-option]');
  if (dropdownOption) {
    const dropdown = dropdownOption.closest('.dropdown');
    const trigger = dropdown?.querySelector('[data-action="open-dropdown"]');
    if (trigger) { trigger.textContent = dropdownOption.textContent.trim(); trigger.setAttribute('data-selected-value', dropdownOption.dataset.value); }
    const menu = dropdown?.querySelector('.dropdown-menu'); if (menu) menu.hidden = true;
    return;
  }
  const routeButton = event.target.closest('[data-route]');
  if (routeButton) {
    state.route = routeButton.dataset.route;
    currentInstanceId = null;
    state.accountMenuOpen = false;
    render();
    return;
  }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    await handleAction(actionButton.dataset.action, actionButton);
    return;
  }
  if (event.target.closest('[data-chip]')) return;
});

overlayRoot.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) await handleAction(actionButton.dataset.action, actionButton);
  else if (event.target.matches('[data-modal-backdrop]')) { modalCleanup?.(); modalCleanup = null; cleanupNewInstanceModal(); overlayRoot.innerHTML = ''; state.modal = ''; }
});

appRoot.addEventListener('submit', async (event) => {
  const form = event.target.closest('[data-form]');
  if (!form) return;
  event.preventDefault();
  if (form.dataset.form === 'offline') {
    const username = new FormData(form).get('username')?.toString().trim() || '';
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) { showToast(t('invalidUsername'), 'error'); return; }
    await addOfflineAccount(username);
  }
});

appRoot.addEventListener('error', (event) => {
  if (event.target instanceof HTMLImageElement && event.target.classList.contains('project-icon')) event.target.style.visibility = 'hidden';
}, true);

appRoot.addEventListener('contextmenu', (event) => {
  const instance = event.target.closest('[data-action="play-instance"]');
  if (!instance) return;
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY, instance.dataset.id);
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-account-popover]') && !event.target.closest('[data-action="toggle-account-menu"]') && state.accountMenuOpen) {
    state.accountMenuOpen = false;
    const popover = overlayRoot.querySelector('[data-account-popover]');
    if (popover) popover.remove();
  }
  if (!event.target.closest('.context-menu') && !event.target.closest('[data-action="play-instance"]')) {
    const menu = overlayRoot.querySelector('.context-menu');
    if (menu) menu.remove();
  }
});


window.addEventListener('prime:navigate', (event) => {
  const route = event.detail?.route;
  if (!['dashboard', 'content', 'servers', 'customization', 'library', 'settings'].includes(route)) return;
  currentInstanceId = null;
  state.route = route;
  state.accountMenuOpen = false;
  render();
});
window.addEventListener('prime:navigate-instance', (event) => {
  const id = event.detail?.id;
  if (typeof id !== 'string' || !id) return;
  currentInstanceId = id;
  state.route = 'instance';
  state.accountMenuOpen = false;
  render();
});
window.addEventListener('prime:instances-updated', () => {
  void refreshInstances().then(() => render());
});
window.addEventListener('prime:context-instance', (event) => {
  const detail = event.detail || {};
  if (typeof detail.id === 'string' && detail.id) showContextMenu(Number(detail.x) || 0, Number(detail.y) || 0, detail.id);
});

window.prime.launch.onProgress(() => { /* Progress is consumed by the instance page; 100% may also mean install completion. */ });
window.prime.launch.onLog((payload) => {
  if (payload.level === 'error') showToast(payload.message, 'error');
});

await loadCoreData();
render();
