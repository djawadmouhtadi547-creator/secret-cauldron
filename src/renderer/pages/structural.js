import { Icon, Badge } from '../components/ui.js';

const pageKeys = {
  content: ['navContent', 'pageContentDesc', 'package'],
  servers: ['navServers', 'pageServersDesc', 'globe'],
  customization: ['navCustomization', 'pageCustomizationDesc', 'tshirt'],
  library: ['navLibrary', 'pageLibraryDesc', 'archive'],
  instance: ['instances', 'pageInstanceDesc', 'cubes'],
  settings: ['navSettings', 'pageSettingsDesc', 'settings']
};
export function renderStructuralPage(route, t) {
  const [title, description, icon] = pageKeys[route] || pageKeys.settings;
  return `<div class="page-content structural-page"><header class="page-header"><div><h1 class="page-title">${t(title)}</h1><p class="page-subtitle">${t(description)}</p></div>${Badge({ label: t('stageOne'), tone: 'accent' })}</header><section class="structural-placeholder card"><div class="structural-icon">${Icon(icon, 'icon-lg')}</div><h2>${t('underConstruction')}</h2><p>${t('underConstructionDesc')}</p><div class="stage-progress"><span></span></div><small>${t('stageOne')} · ${t('mockData')}</small></section></div>`;
}
