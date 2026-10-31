import { getState, saveState } from './state.js';

const DAY = 24 * 60 * 60 * 1000;

export function startPlaySession(instanceId, sessionId) {
  const state = getState();
  const startedAt = new Date().toISOString();
  state.playSessions.push({ instanceId, sessionId, startedAt, endedAt: null });
  if (state.playSessions.length > 5000) state.playSessions.splice(0, state.playSessions.length - 5000);
  const instance = state.instances.find((item) => item.id === instanceId);
  if (instance) {
    instance.lastPlayed = startedAt;
    saveState();
  }
  return startedAt;
}

export function endPlaySession(instanceId, sessionId, endedAt = new Date().toISOString()) {
  const state = getState();
  const session = [...state.playSessions].reverse().find((item) => item.instanceId === instanceId && item.sessionId === sessionId && !item.endedAt);
  if (!session) return false;
  session.endedAt = endedAt;
  const duration = Math.max(0, Date.parse(endedAt) - Date.parse(session.startedAt));
  const instance = state.instances.find((item) => item.id === instanceId);
  if (instance) instance.playtimeMinutes = Math.max(0, Number(instance.playtimeMinutes) || 0) + Math.floor(duration / 60_000);
  saveState();
  return true;
}

export function closeAbandonedSessions() {
  const now = new Date().toISOString();
  let changed = false;
  for (const session of getState().playSessions) {
    if (!session.endedAt) {
      session.endedAt = now;
      changed = true;
    }
  }
  if (changed) saveState();
}

export function getSummary(now = Date.now()) {
  const sessions = getState().playSessions;
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now - (13 - index) * DAY);
    date.setHours(0, 0, 0, 0);
    return date;
  });
  const dailyMinutes = days.slice(7).map((date) => {
    const end = date.getTime() + DAY;
    const minutes = sessions.reduce((total, session) => {
      const start = Date.parse(session.startedAt);
      const finish = Date.parse(session.endedAt || new Date().toISOString());
      const overlap = Math.max(0, Math.min(finish, end) - Math.max(start, date.getTime()));
      return total + overlap / 60_000;
    }, 0);
    return { day: date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(), minutes: Math.round(minutes) };
  });
  const total = dailyMinutes.reduce((sum, item) => sum + item.minutes, 0);
  const previous = sessions.reduce((sum, session) => {
    const start = Date.parse(session.startedAt);
    const finish = Date.parse(session.endedAt || new Date().toISOString());
    const periodStart = now - 14 * DAY;
    const periodEnd = now - 7 * DAY;
    return sum + Math.max(0, Math.min(finish, periodEnd) - Math.max(start, periodStart)) / 60_000;
  }, 0);
  const completed = sessions.filter((session) => session.endedAt).map((session) => Math.max(0, Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60_000);
  const previousRounded = Math.round(previous);
  const playedDays = new Set(sessions.filter((session) => Date.parse(session.startedAt) >= now - 7 * DAY).map((session) => new Date(session.startedAt).toISOString().slice(0, 10)));
  return {
    last7DaysMinutes: total,
    previous7DaysMinutes: previousRounded,
    changePercent: previousRounded ? Math.round((total - previousRounded) / previousRounded * 100) : total ? 100 : 0,
    dailyMinutes,
    averageSessionMinutes: completed.length ? Math.round(completed.reduce((sum, item) => sum + item, 0) / completed.length) : 0,
    longestSessionMinutes: completed.length ? Math.round(Math.max(...completed)) : 0,
    daysPlayed: playedDays.size
  };
}
