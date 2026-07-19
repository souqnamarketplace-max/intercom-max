import { useState } from 'react';
import { api, ApiError, type ResidentMe } from '../api/client';

export default function EntryPin({ me, onBack, onUpdated }: { me: ResidentMe; onBack: () => void; onUpdated: () => void }) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setError(null);
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs don\u2019t match');
      return;
    }
    setSaving(true);
    try {
      await api.setDoorPin(pin);
      setSaved(true);
      onUpdated();
      setTimeout(() => setSaved(false), 2000);
      setPin('');
      setConfirmPin('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save PIN');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <div className="home-header">
        <button className="btn-text" onClick={onBack} style={{ marginBottom: 8 }}>{'\u2190'} Back</button>
        <h1>Entry PIN</h1>
        <p className="unit">{me.hasDoorPin ? 'Change your door PIN' : 'Set a door PIN'}</p>
      </div>

      <div className="section">
        {/* PINs are stored hashed (like a password) - never recoverable as
            plain digits, same reason a password manager can't show you a
            forgotten password back. This status line is the honest
            alternative: confirms whether one exists without pretending to
            reveal it. */}
        <div className="pass-row" style={{ marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Current status</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              PINs can't be displayed once set (stored securely) — only replaced.
            </div>
          </div>
          <span
            style={{
              fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
              background: me.hasDoorPin ? 'rgba(201,164,106,0.15)' : 'rgba(123,130,144,0.15)',
              color: me.hasDoorPin ? 'var(--brass)' : 'var(--slate)',
            }}
          >
            {me.hasDoorPin ? 'PIN is set' : 'No PIN set'}
          </span>
        </div>

        <p className="muted" style={{ fontSize: 13.5, marginBottom: 16 }}>
          This PIN is entered on the intercom panel's keypad to open the door
          {me.hasDoorPin ? ' — setting a new one replaces the current PIN immediately.' : '.'}
        </p>

        <label className="field-label">New PIN</label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="4\u20138 digits"
          maxLength={8}
        />

        <label className="field-label" style={{ marginTop: 12 }}>Confirm PIN</label>
        <input
          type="password"
          inputMode="numeric"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          placeholder="Re-enter PIN"
          maxLength={8}
        />

        {error && <p className="error">{error}</p>}
        {saved && <p className="muted" style={{ color: 'var(--brass)' }}>PIN saved.</p>}

        <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving\u2026' : 'Save PIN'}
        </button>
      </div>
    </div>
  );
}
