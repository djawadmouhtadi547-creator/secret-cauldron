import { Icon, Badge, Button, Card, EmptyState, escapeHtml } from '../components/ui.js';

function compactNumber(value) {
  const number = Number(value) || 0;
  if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
  if (number >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
  return String(number);
}
function duration(minutes, t) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}${t('hours')} ${rest}${t('minutes')}` : `${rest}${t('minutes')}`;
}

export function renderDashboard({ t, account, instances = [], projects = [], servers = [], news = [], playtime }) {
  const user = account?.username || t('player');
  const greetings = ['dashboardGreeting1', 'dashboardGreeting2', 'dashboardGreeting3'];
  const subtitles = ['dashboardSub1', 'dashboardSub2', 'dashboardSub3'];
  const pick = Math.abs(user.length) % 3;
  const greeting = t(greetings[pick]).replace('{name}', `<bdi dir="ltr">${escapeHtml(user)}</bdi>`);
  const subtitle = t(subtitles[(pick + 1) % 3]);

  const quickInstances = instances.slice(0, 8);
  const quickContent = quickInstances.map((instance) => `<button class="quick-instance ${instance.id === 'active-instance' ? 'active' : ''}" data-action="play-instance" data-id="${escapeHtml(instance.id)}" title="${escapeHtml(instance.name)}"><span class="quick-cube">${Icon(instance.icon || 'grass')}</span></button>`).join('');
  const emptyQuick = Array.from({ length: Math.max(0, 8 - quickInstances.length) }, () => `<button class="quick-instance empty" data-action="new-instance" title="${escapeHtml(t('newInstance'))}">${Icon('cubes')}</button>`).join('');
  const projectCards = projects.slice(0, 3).map((project) => `
    <article class="project-card card">
      <div class="project-banner" style="background-image:linear-gradient(180deg,transparent,rgba(0,0,0,.5)),url('${escapeHtml(project.bannerUrl)}')"><span class="project-source">${escapeHtml(project.source.toUpperCase())}</span></div>
      <div class="project-card-body">
        <img class="project-icon" src="${escapeHtml(project.iconUrl)}" alt="">
        <div class="project-title-row"><h3>${escapeHtml(project.title)}</h3><span class="download-count mono">${compactNumber(project.downloads)}</span></div>
        <p>${escapeHtml(project.description)}</p>
        <div class="project-meta">${Icon('user', 'icon-sm')}<span>${t('projectAuthor').replace('{author}', escapeHtml(project.author))}</span></div>
      </div>
    </article>`).join('');

  const serverRows = servers.slice(0, 5).map((server, index) => `
    <div class="server-row">
      <div class="server-rank mono">#${index + 1}</div>
      <div class="server-avatar">${Icon('globe')}</div>
      <div class="server-info"><strong>${escapeHtml(server.name)}</strong><span><i class="online-dot"></i><bdi dir="ltr">${compactNumber(server.players)}</bdi> ${t('playersOnline')}</span></div>
      <span class="server-kind">${t('serverType')}</span>
      <span class="server-version mono">${escapeHtml(server.version)}</span>
    </div>`).join('');

  const play = playtime || { last7DaysMinutes: 0, previous7DaysMinutes: 0, changePercent: 0, dailyMinutes: [], averageSessionMinutes: 0, longestSessionMinutes: 0, daysPlayed: 0 };
  const comparison = play.last7DaysMinutes > play.previous7DaysMinutes ? t('moreThanLastWeek') : play.last7DaysMinutes < play.previous7DaysMinutes ? t('lessThanLastWeek') : t('sameAsLastWeek');
  const maxMinutes = Math.max(1, ...play.dailyMinutes.map((day) => day.minutes));
  const bars = play.dailyMinutes.map((day, index) => `<div class="play-bar-wrap"><span class="play-bar-value">${index === play.dailyMinutes.length - 1 ? duration(day.minutes, t) : ''}</span><div class="play-bar ${index === play.dailyMinutes.length - 1 ? 'today' : ''}" style="height:${Math.max(3, day.minutes / maxMinutes * 74)}px"></div><span class="play-day">${escapeHtml(t(day.day))}</span></div>`).join('');
  const featureNews = news[0];
  const newsCard = featureNews ? `
    <article class="feature-news card">
      <div class="feature-news-image" style="background-image:url('${escapeHtml(featureNews.imageUrl)}')"></div>
      <div class="feature-news-copy"><div class="news-meta">${Badge({ label: t('newsBadge'), tone: 'accent' })}<span>${new Date(featureNews.publishedAt).toLocaleDateString(t('languageDirection') === 'rtl' ? 'ar-DZ' : 'en-US')}</span></div><h3>${escapeHtml(featureNews.title)}</h3><p>${escapeHtml(featureNews.summary)}</p><a class="text-link" href="${escapeHtml(featureNews.url)}" target="_blank" rel="noreferrer">${t('readMore')} ${Icon('arrow-up-right', 'icon-sm')}</a></div>
    </article>` : EmptyState({ title: t('noNews'), icon: 'news' });

  return `
    <div class="page-content dashboard-page">
      <header class="dashboard-hero">
        <div><h1>${greeting}</h1><p>${subtitle}</p></div>
        <button class="btn btn-outline hero-library" data-route="library">${Icon('archive')}<span>${t('browseLibrary')}<small>${t('exploreVersions')}</small></span></button>
      </header>

      <section class="quick-play-section">
        <div class="section-heading"><h2>${Icon('play', 'icon-sm')} ${t('quickPlay')}</h2><span class="muted">${t('mockData')}</span></div>
        <div class="quick-play-bar"><div class="quick-play-label">${Icon('layers')}<strong>${t('quickPlay')}</strong></div><div class="quick-divider"></div><div class="quick-instances">${quickContent}${emptyQuick}</div></div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading"><div><h2>${t('exploreContent')}</h2><span class="muted">${t('popularProjects')}</span></div><button class="btn btn-ghost" data-route="content">${Icon('arrow-up-right', 'icon-sm')}</button></div>
        <div class="project-grid">${projectCards || EmptyState({ title: t('empty') })}</div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading"><div><h2>${t('servers')}</h2><span class="muted">${t('topServers')}</span></div><button class="btn btn-ghost" data-route="servers">${Icon('arrow-up-right', 'icon-sm')}</button></div>
        <div class="server-list card">${serverRows || EmptyState({ title: t('empty') })}</div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading"><div><h2>${t('yourPlaytime')}</h2><span class="muted">${t('lastSevenDays')}</span></div><span class="badge badge-success">${Icon('arrow-up-right', 'icon-sm')}${Math.abs(play.changePercent)}%</span></div>
        <div class="playtime-card card">
          <div class="playtime-top"><div><strong class="playtime-total mono">${duration(play.last7DaysMinutes, t)}</strong><p>${t('lastSevenDays')} · ${Math.abs(play.changePercent)}% ${comparison}</p></div><span class="playtime-caption">${t('weekComparison')}</span></div>
          <div class="playtime-chart">${bars}</div>
          <div class="playtime-stats"><div><strong class="mono">${duration(play.averageSessionMinutes, t)}</strong><span>${t('averageSession')}</span></div><div><strong class="mono">${duration(play.longestSessionMinutes, t)}</strong><span>${t('longestSession')}</span></div><div><strong class="mono">${play.daysPlayed}/7</strong><span>${t('daysPlayed')}</span></div></div>
        </div>
      </section>

      <section class="dashboard-section">
        <div class="section-heading"><h2>${t('news')}</h2><span class="muted">${t('newsSource')}</span></div>
        ${newsCard}
      </section>
      <div class="dashboard-footnote">${Icon('info', 'icon-sm')}<span>${t('betaNotice')}</span></div>
    </div>`;
}

export function renderNewsPanel({ t, news = [] }) {
  const entries = news.slice(0, 4).map((item) => `
    <a class="side-news-item" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">
      <img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">
      <span class="side-news-copy"><strong>${escapeHtml(item.title)}</strong><small>${new Date(item.publishedAt).toLocaleDateString(t('languageDirection') === 'rtl' ? 'ar-DZ' : 'en-US')}</small></span>
    </a>`).join('');
  return `
    <div class="side-news-heading"><div>${Icon('news')}<strong>${t('news')}</strong></div><button class="icon-button" data-action="refresh-news" title="${t('refresh')}">${Icon('refresh', 'icon-sm')}</button></div>
    <div class="side-news-list">${entries || `<div class="muted small">${t('noNews')}</div>`}</div>
    <section class="studio-card card">
      <div class="studio-card-top"><img src="../../assets/logo/prime-mark.svg" alt="Prime"><div><strong>Gmu Studios</strong><small>${t('primeStudioTitle')}</small></div><button class="icon-button" data-action="support-info" aria-label="${t('visitStudio')}">${Icon('arrow-up-right', 'icon-sm')}</button></div>
      <p>${t('primeStudioDescription')}</p>
    </section>
    <div class="side-social"><span title="${t('socialWebsite')}">${Icon('globe')}</span><span title="${t('socialDiscord')}">${Icon('users')}</span><span title="${t('socialX')}">${Icon('at-sign')}</span><span title="${t('socialYoutube')}">${Icon('play')}</span><span title="${t('socialReddit')}">${Icon('message-circle')}</span></div>`;
}
