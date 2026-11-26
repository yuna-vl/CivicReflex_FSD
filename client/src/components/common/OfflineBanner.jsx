import { useEffect, useState } from 'react';
import { getQueuedCount } from '../../utils/offlineQueue';

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queued, setQueued] = useState(getQueuedCount());

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => setQueued(getQueuedCount()), 2000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, []);

  if (online && queued === 0) return null;

  return (
    <div
      role="status"
      style={{ padding: '0.5rem 1rem', textAlign: 'center', fontWeight: 600, background: online ? '#FDF4E6' : '#FEE2E2', color: '#0B2545' }}
    >
      {online
        ? `${queued} report(s) waiting to be sent`
        : 'You are offline. Reports will be saved and sent when you reconnect.'}
    </div>
  );
}