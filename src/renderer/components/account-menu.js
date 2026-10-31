import { Icon, Badge, escapeHtml } from './ui.js';

export function renderAccountMenu({ t, account, accounts = [] }) {
  const active = account || accounts.find((item) => item.active);
  if (!active) return '';
  const alternatives = accounts.filter((item) => item.id !== active.id).map((item) => `<button class="account-switch-row" data-action="switch-account" data-id="${escapeHtml(item.id)}"><span class="account-mini-avatar">${Icon('user')}</span><span><strong class="mono">${escapeHtml(item.username)}</strong><small>${item.type === 'offline' ? t('offlineAccount') : t('microsoftAccount')}</small></span></button>`).join('');
  return `<div class="account-popover" data-account-popover hidden>
    <div class="account-popover-user"><div class="account-avatar-large">${Icon('user')}<i></i></div><div class="account-popover-name"><strong class="mono">${escapeHtml(active.username)}</strong><small>${active.type === 'offline' ? t('offlineAccount') : t('microsoftAccount')}</small></div><span class="connected-dot" title="${t('connected')}"></span></div>
    ${alternatives ? `<div class="account-divider"></div><div class="account-list-label">${t('switchAccount')}</div>${alternatives}` : ''}
    <div class="account-divider"></div>
    <button class="btn btn-outline account-add" data-action="add-account">${Icon('plus')}<span>${t('addAccount')}</span></button>
    <button class="account-logout" data-action="logout-account" data-id="${escapeHtml(active.id)}">${Icon('logout', 'icon-sm')}<span>${t('logout')}</span></button>
  </div>`;
}
