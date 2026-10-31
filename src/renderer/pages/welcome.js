import { Icon, Button, escapeHtml } from '../components/ui.js';

export function renderWelcome(t, mode = 'choose', dismissed = false) {
  if (dismissed) {
    return `<main class="welcome-screen"><section class="welcome-reopen"><img class="welcome-logo" src="../../assets/logo/prime.svg" alt="Prime Launcher"><h1>${t('welcomeTitle')}</h1><button class="btn btn-primary" data-action="reopen-welcome">${t('addAccount')}</button></section><p class="welcome-copyright">${t('copyright')}</p></main>`;
  }
  const card = mode === 'offline' ? `
    <button class="welcome-back" data-action="welcome-back">${Icon('arrow-left', 'icon-sm')}<span>${t('offlineBack')}</span></button>
    <div class="welcome-brand-mark"><img src="../../assets/logo/prime.svg" alt="Prime"></div>
    <h1>${t('welcomeTitle')}</h1>
    <p class="welcome-subtitle">${t('offlineAccount')}</p>
    <form class="offline-form" data-form="offline">
      <label for="offline-username">${t('usernameLabel')}</label>
      <input id="offline-username" class="field offline-input" name="username" type="text" minlength="3" maxlength="16" autocomplete="off" placeholder="${escapeHtml(t('usernamePlaceholder'))}" pattern="[a-zA-Z0-9_]{3,16}" required>
      <span class="field-hint">${t('usernameHint')}</span>
      <button class="btn btn-primary offline-submit" type="submit" disabled>${Icon('arrow-left')}<span>${t('loginArrow')}</span></button>
    </form>
    <div class="offline-info">${Icon('info', 'icon-sm')}<span>${t('offlineInfo')}</span></div>
  ` : `
    <div class="welcome-brand-mark"><img src="../../assets/logo/prime.svg" alt="Prime"></div>
    <h1>${t('welcomeTitle')}</h1>
    <p class="welcome-subtitle">${t('welcomeSubtitle')}</p>
    <div class="welcome-actions">
      <button class="btn btn-primary welcome-auth-button" data-action="microsoft-login">${Icon('windows', 'icon-lg')}<span>${t('microsoft')}</span></button>
      <button class="btn btn-outline welcome-auth-button" data-action="offline-login">${Icon('user', 'icon-lg')}<span>${t('offline')}</span></button>
    </div>
  `;
  return `
    <main class="welcome-screen">
      <section class="welcome-card">
        <button class="welcome-close" data-action="close-welcome" aria-label="${escapeHtml(t('closeWelcome'))}">${Icon('x')}</button>
        ${card}
      </section>
      <p class="welcome-copyright">${t('copyright')}</p>
      <span class="welcome-version mono">v${t('version')}</span>
    </main>`;
}
