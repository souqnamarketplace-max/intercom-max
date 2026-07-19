import { useEffect, useState } from 'react';
import { api, type ResidentMessage } from '../api/client';

export default function Messages({ onBack }: { onBack: () => void }) {
  const [messages, setMessages] = useState<ResidentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMyMessages()
      .then(setMessages)
      .catch(() => setError('Could not load messages'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen">
      <div className="home-header">
        <button className="btn-text" onClick={onBack} style={{ marginBottom: 8 }}>{'\u2190'} Back</button>
        <h1>Messages</h1>
        <p className="unit">From your building's intercom</p>
      </div>

      <div className="section">
        {loading && <p className="muted">Loading{'\u2026'}</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="muted">No messages yet.</p>
        )}
        {!loading && messages.map((m) => (
          <div key={m.id} className="pass-row" style={{ alignItems: 'flex-start' }}>
            {m.photoUrl && (
              <img
                src={m.photoUrl}
                alt=""
                style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', marginRight: 12, flexShrink: 0 }}
              />
            )}
            <div>
              <div style={{ fontSize: 14.5 }}>{m.body}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
