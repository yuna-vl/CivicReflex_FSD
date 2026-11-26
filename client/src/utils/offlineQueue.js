const KEY = 'civicreflex_offline_queue';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
};

const write = (items) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full or blocked
  }
};

export const queueReport = (payload) => {
  const items = read();
  items.push({ ...payload, queuedAt: new Date().toISOString() });
  write(items);
};

export const getQueuedCount = () => read().length;

// submitFn sends one saved report and throws if it fails
export const flushQueue = async (submitFn) => {
  if (!navigator.onLine) return 0;
  const remaining = [];
  let sent = 0;
  for (const item of read()) {
    try {
      await submitFn(item);
      sent += 1;
    } catch {
      remaining.push(item);
    }
  }
  write(remaining);
  return sent;
};