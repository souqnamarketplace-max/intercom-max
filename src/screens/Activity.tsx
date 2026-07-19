import { useEffect, useState } from 'react';
import { api, type AuditEvent } from '../api/client';

const EVENT_LABELS: Record<string, string> = {
  call_answered: 'Video call answered',
  call_missed: 'Missed call',
  call_declined: 'Call declined',
  unlock_app: 'Swipe to Open',
  unlock_pin: 'Door PIN',
  unlock_virtual_key: 'Virtual key',
  unlock_card_fob: 'Card fob',
  unlock_admin_override: 'Staff override',
  failed_pin_attempt: 'Failed PIN attempt',
  failed_fob_attempt: 'Failed fob attempt',
};

export default function Activity({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await api.getMyActivity();
      setEvents(result.events);
      setNextCursor(result.nextCursor);
      setError(null);
    } catch {
      setError('Could not load activity');
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await api.getMyActivity(nextCursor);
      setEvents((prev) => [...prev, ...result.events]);
      setNextCursor(result.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="screen">
      <div className="home-header">
        <button className="btn-text" onClick={onBack} style={{ marginBottom: 8 }}>{'\u2190'} Back</button>
        <h1>Activity</h1>
        <p className="unit">Access events for your unit</p>
      </div>

      <div className="section">
        {loading && <p className="muted">Loading{'\u2026'}</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="muted">No activity yet.</p>
        )}
        {!loading && events.map((e) => (
          <div key={e.id} className="pass-row">
            <div>
              <div style={{ fontWeight: 600 }}>{EVENT_LABELS[e.eventType] ?? e.eventType}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {new Date(e.createdAt).toLocaleString()} {'\u00B7'} {e.result}
              </div>
            </div>
          </div>
        ))}
        {nextCursor && (
          <button className="btn-text" style={{ marginTop: 12 }} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading\u2026' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  );
}
