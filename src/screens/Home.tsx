import { useEffect, useState } from 'react';
import { api, clearToken, type ResidentMe } from '../api/client';

interface Props {
  me: ResidentMe | null;
  error: string | null;
  onLoggedOut: () => void;
  onOpenVirtualKeys: () => void;
  onOpenMessages: () => void;
  onOpenEntryPin: () => void;
  onOpenAccount: () => void;
}

function IconKey() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="4.5" />
      <path d="M11.2 11.2L20 20M15.5 15.5L18.5 18.5M17.5 13.5L20.5 16.5" />
    </svg>
  );
}
function IconKeypad() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7L16 16M8 8L6.3 6.3" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#201705" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function Home({ me, error, onLoggedOut, onOpenVirtualKeys, onOpenMessages, onOpenEntryPin, onOpenAccount }: Props) {
  const [accessPoints, setAccessPoints] = useState<{ id: string; name: string }[]>([]);
  const [doorStates, setDoorStates] = useState<Record<string, 'idle' | 'opening' | 'opened' | 'failed'>>({});
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api.getMyAccessPoints()
      .then(setAccessPoints)
      .catch(() => setAccessError('Could not load your accessible doors'));
  }, [me]);

  const handleLogout = async () => {
    await clearToken();
    onLoggedOut();
  };

  async function handleOpenDoor(entryPointId: string) {
    setDoorStates((prev) => ({ ...prev, [entryPointId]: 'opening' }));
    try {
      await api.openDoor(entryPointId);
      setDoorStates((prev) => ({ ...prev, [entryPointId]: 'opened' }));
      setTimeout(() => setDoorStates((prev) => ({ ...prev, [entryPointId]: 'idle' })), 2500);
    } catch {
      setDoorStates((prev) => ({ ...prev, [entryPointId]: 'failed' }));
      setTimeout(() => setDoorStates((prev) => ({ ...prev, [entryPointId]: 'idle' })), 2500);
    }
  }

  if (error) {
    return (
      <div className="screen center">
        <p className="error">{error}</p>
        <button className="btn" onClick={handleLogout}>Log out</button>
      </div>
    );
  }

  if (!me) {
    return <div className="screen center"><p className="muted">Loading{'\u2026'}</p></div>;
  }

  return (
    <div className="screen">
      <div className="home-header">
        <p className="eyebrow">Welcome back</p>
        <h1>{me.name}</h1>
        <p className="unit">UNIT {me.unitNumber}</p>
      </div>

      {/* My Access — one entry per door the resident can actually reach
          (shared spaces + their zone's doors). Real audit-event logging now;
          the physical relay trigger needs a Pi controller, which isn't
          installed at any site yet. */}
      <div className="section">
        <h2 className="section-title">My Access</h2>
        {accessError && <p className="error">{accessError}</p>}
        {!accessError && accessPoints.length === 0 && (
          <p className="muted" style={{ fontSize: 13.5 }}>
            No doors assigned yet \u2014 contact your property manager if this looks wrong.
          </p>
        )}
        <div className="access-grid">
          {accessPoints.map((ep) => {
            const state = doorStates[ep.id] ?? 'idle';
            return (
              <button
                key={ep.id}
                className="door-btn door-btn-compact"
                disabled={state === 'opening'}
                onClick={() => handleOpenDoor(ep.id)}
                title={state === 'opened' ? 'Door opened' : `Swipe or tap to open ${ep.name}`}
              >
                <IconLock />
                <span className="label">
                  {state === 'opening' ? 'Opening\u2026' : state === 'opened' ? 'Opened' : state === 'failed' ? 'Try Again' : ep.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Quick actions</h2>
        <div className="action-grid">
          <button className="action-tile" onClick={onOpenVirtualKeys}>
            <IconKey />
            Virtual Keys
          </button>
          <button className="action-tile" onClick={onOpenEntryPin}>
            <IconKeypad />
            Entry PIN
          </button>
          <button className="action-tile" onClick={onOpenMessages}>
            <IconClock />
            Messages
          </button>
          <button className="action-tile" onClick={onOpenAccount}>
            <IconGear />
            Settings
          </button>
        </div>
      </div>

      <div className="logout-row">
        <button className="btn-text" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}
