import { useState } from 'react';
import { api, ApiError, clearToken, type ResidentMe } from '../api/client';

export default function Account({
  me, onBack, onLoggedOut, onOpenEntryPin, onOpenActivity, onUpdated,
}: {
  me: ResidentMe;
  onBack: () => void;
  onLoggedOut: () => void;
  onOpenEntryPin: () => void;
  onOpenActivity: () => void;
  onUpdated: () => void;
}) {
  const [email, setEmail] = useState(me.email ?? '');
  const [phone, setPhone] = useState(me.phone ?? '');
  const [notifications, setNotifications] = useState(me.notificationsEnabled);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await api.updateMe({
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notificationsEnabled: notifications,
      });
      setSaved(true);
      onUpdated();
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await clearToken();
    onLoggedOut();
  }

  return (
    <div className="screen">
      <div className="home-header">
        <button className="btn-text" onClick={onBack} style={{ marginBottom: 8 }}>{'\u2190'} Back</button>
        <h1>Account</h1>
        <p className="unit">Unit {me.unitNumber} {'\u00B7'} {me.siteName}</p>
      </div>

      <div className="section">
        <label className="field-label">Email address</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

        <label className="field-label" style={{ marginTop: 12 }}>Phone number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-000-0000" />

        <div className="pass-row" style={{ marginTop: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Notifications</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Calls and access alerts for this unit</div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} />
            <span className="switch-track" />
          </label>
        </div>

        {error && <p className="error">{error}</p>}
        {saved && <p className="muted" style={{ color: 'var(--brass)' }}>Saved.</p>}

        <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving\u2026' : 'Save changes'}
        </button>
      </div>

      <div className="section">
        <h2 className="section-title">Access</h2>
        <div className="pass-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Entry PIN</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              {me.hasDoorPin ? 'PIN is set' : 'No PIN set yet'}
            </div>
          </div>
          <button className="btn-text" onClick={onOpenEntryPin}>
            {me.hasDoorPin ? 'Change' : 'Set up'}
          </button>
        </div>
        <div className="pass-row">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Activity Log</div>
            <div className="muted" style={{ fontSize: 12.5 }}>Access events for your unit</div>
          </div>
          <button className="btn-text" onClick={onOpenActivity}>View</button>
        </div>
      </div>

      <div className="logout-row">
        <button className="btn-text" onClick={handleLogout}>Log out</button>
      </div>
    </div>
  );
}
