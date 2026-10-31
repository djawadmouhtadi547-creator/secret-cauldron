export function createLaunchMock({ emit, appendLog }) {
  const timers = new Map();

  function start(instance) {
    const instanceId = instance.id;
    const sessionId = `mock-${Date.now().toString(36)}`;
    appendLog('info', `Mock launch requested for ${instance.name}. Minecraft is not started in stage 1.`, instanceId, sessionId);
    if (timers.has(instanceId)) clearInterval(timers.get(instanceId));
    let percent = 0;
    const timer = setInterval(() => {
      percent = Math.min(100, percent + 20);
      emit('launch:progress', { instanceId, sessionId, percent, stage: percent === 100 ? 'mock_complete' : 'preparing_mock' });
      if (percent === 100) {
        appendLog('warn', 'Mock launch finished. The real Java launcher is not part of stage 1.', instanceId, sessionId);
        clearInterval(timer);
        timers.delete(instanceId);
      }
    }, 350);
    timers.set(instanceId, timer);
    return { sessionId, status: 'mock' };
  }

  function stop(instanceId) {
    const timer = timers.get(instanceId);
    if (timer) clearInterval(timer);
    timers.delete(instanceId);
    return Boolean(timer);
  }

  function dispose() {
    for (const timer of timers.values()) clearInterval(timer);
    timers.clear();
  }

  return { start, stop, dispose };
}
