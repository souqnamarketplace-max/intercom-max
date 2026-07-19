import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { api, ApiError, type VirtualKey, type PassPreset } from '../api/client';

interface Props {
  onBack: () => void;
}

type PassKind = 'qr' | 'pin';

// Formats a Date for a <input type="datetime-local"> value in local time
// (not UTC — toISOString() would show the wrong wall-clock time to the
// resident). Used to default Starts/Ends to "now" instead of a blank
// yyyy-mm-dd field, since a pass usually starts immediately.
function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function VirtualKeys({ onBack }: Props) {
  const [passes, setPasses] = useState<VirtualKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState<PassKind | null>(null);
  const [revealedPin, setRevealedPin] = useState<{ recipientName: string; code: string } | null>(null);
  const [viewingQr, setViewingQr] = useState<{ recipientName: string; token: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.listMyPasses();
      setPasses(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your passes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this pass? It stops working immediately.')) return;
    await api.revokeMyPass(id);
    load();
  }

  return (
    <div className="screen">
      <div className="home-header">
        <button className="btn-text" onClick={onBack} style={{ marginBottom: 8 }}>{'\u2190'} Back</button>
        <h1>Virtual Keys</h1>
        <p className="unit">Share access with a visitor or delivery carrier</p>
      </div>

      <div className="action-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <button className="action-tile" onClick={() => setShowCreate('qr')}>
          <span>Visitor Pass</span>
          <span className="muted" style={{ fontSize: 12 }}>QR code</span>
        </button>
        <button className="action-tile" onClick={() => setShowCreate('pin')}>
          <span>Delivery Pass</span>
          <span className="muted" style={{ fontSize: 12 }}>PIN code</span>
        </button>
      </div>

      <div className="section">
        <h2 className="section-title">Your passes</h2>
        {loading && <p className="muted">Loading{'\u2026'}</p>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && passes.length === 0 && (
          <p className="muted">No passes yet. Generate one above.</p>
        )}
        {!loading && passes.map((p) => (
          <div
            key={p.id}
            className="pass-row"
            style={{ cursor: p.accessMethod === 'qr' && p.status === 'active' ? 'pointer' : 'default' }}
            onClick={() => {
              if (p.accessMethod === 'qr' && p.status === 'active') {
                setViewingQr({ recipientName: p.recipientName, token: p.signedToken });
              }
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{p.recipientName}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>
                {p.accessMethod === 'qr' ? 'Visitor Pass \u00B7 QR' : 'Delivery Pass \u00B7 PIN'}
                {' \u00B7 '}
                {p.status}
                {p.expiresAt ? ` \u00B7 expires ${new Date(p.expiresAt).toLocaleDateString()}` : ''}
                {p.accessMethod === 'qr' && p.status === 'active' ? ' \u00B7 tap to view' : ''}
              </div>
            </div>
            {p.status === 'active' && (
              <button className="btn-text" onClick={(e) => { e.stopPropagation(); handleRevoke(p.id); }}>Revoke</button>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <CreatePassSheet
          kind={showCreate}
          onClose={() => setShowCreate(null)}
          onCreated={(created) => {
            if (created.accessMethod === 'pin' && created.rawShortCode) {
              setRevealedPin({ recipientName: created.recipientName, code: created.rawShortCode });
            }
            load();
          }}
        />
      )}

      {revealedPin && (
        <PinRevealSheet
          recipientName={revealedPin.recipientName}
          code={revealedPin.code}
          onClose={() => setRevealedPin(null)}
        />
      )}

      {viewingQr && (
        <QRViewSheet
          recipientName={viewingQr.recipientName}
          token={viewingQr.token}
          onClose={() => setViewingQr(null)}
        />
      )}
    </div>
  );
}

const PRESETS: { value: PassPreset; label: string; blurb: string }[] = [
  { value: 'custom', label: 'Custom Duration', blurb: 'Pick an exact start and end time' },
  { value: 'recurring', label: 'Recurring Access', blurb: 'Repeats on chosen days/times' },
  { value: 'business_hours', label: 'Business Hours', blurb: 'Mon\u2013Fri, 9am\u20135pm' },
  { value: 'full_day', label: 'Full-Day Use', blurb: 'Active any time, until revoked' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Shared by both "just created" and "re-viewing an existing pass" - the
// QR is just a client-side render of the stored signed token, so re-
// showing it later needs no new pass, just re-drawing the same string.
// Previously there was no way back to this at all once the initial
// creation sheet closed.
function QRViewSheet({
  recipientName, token, onClose,
}: { recipientName: string; token: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shareSupported, setShareSupported] = useState(false);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, token, { width: 400, margin: 3, errorCorrectionLevel: 'M' });
    }
    setShareSupported(typeof navigator.share === 'function' && typeof navigator.canShare === 'function');
  }, [token]);

  function getBlob(): Promise<Blob | null> {
    return new Promise((resolve) => canvasRef.current?.toBlob((b) => resolve(b), 'image/png'));
  }

  async function handleShare() {
    const blob = await getBlob();
    if (!blob) return;
    const file = new File([blob], `visitor-pass-${recipientName}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Visitor Pass for ${recipientName}` });
      } else {
        await navigator.share({ title: `Visitor Pass for ${recipientName}` });
      }
    } catch {
      // User cancelled the share sheet - not an error.
    }
  }

  async function handleDownload() {
    const blob = await getBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-pass-${recipientName}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>Visitor Pass</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Have {recipientName} scan this at the intercom, or share/save it below.
        </p>
        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', borderRadius: 12 }} />
        <p className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>
          Turn screen brightness up and avoid glare for a faster scan.
        </p>
        <div className="sheet-actions" style={{ gap: 8 }}>
          {shareSupported && <button className="btn-text" onClick={handleShare}>Share</button>}
          <button className="btn-text" onClick={handleDownload}>Download</button>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function CreatePassSheet({
  kind, onClose, onCreated,
}: { kind: PassKind; onClose: () => void; onCreated: (k: VirtualKey) => void }) {
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [preset, setPreset] = useState<PassPreset>('custom');
  const [activatesAt, setActivatesAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [expiresAt, setExpiresAt] = useState(() => toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<VirtualKey | null>(null);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!recipientName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.createMyPass({
        recipientName: recipientName.trim(),
        recipientContact: recipientContact.trim() || undefined,
        keyType: kind === 'qr' ? (preset === 'recurring' ? 'recurring' : 'single_use') : 'delivery',
        accessMethod: kind,
        preset,
        activatesAt: (preset === 'custom' || preset === 'recurring') && activatesAt ? new Date(activatesAt).toISOString() : undefined,
        expiresAt: preset !== 'full_day' && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        schedule: preset === 'recurring' ? { daysOfWeek, timeStart, timeEnd } : undefined,
      });
      onCreated(result);
      if (kind === 'qr') {
        setCreated(result); // show the QR inline before closing, instead of a separate reveal step
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create pass');
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return <QRViewSheet recipientName={created.recipientName} token={created.signedToken} onClose={onClose} />;
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>{kind === 'qr' ? 'New Visitor Pass' : 'New Delivery Pass'}</h3>
        <form onSubmit={handleSubmit}>
          <label className="field-label">Choose a preset</label>
          <div className="preset-grid">
            {PRESETS.map((p) => (
              <button
                type="button"
                key={p.value}
                className={`preset-tile${preset === p.value ? ' selected' : ''}`}
                onClick={() => setPreset(p.value)}
              >
                <span className="preset-label">{p.label}</span>
                <span className="preset-blurb">{p.blurb}</span>
              </button>
            ))}
          </div>

          <label className="field-label" style={{ marginTop: 16 }}>Recipient name</label>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder={kind === 'qr' ? 'e.g. Dog walker' : 'e.g. DHL, Amazon'}
          />

          {kind === 'qr' && (
            <>
              <label className="field-label" style={{ marginTop: 12 }}>Send to (phone or email)</label>
              <input
                value={recipientContact}
                onChange={(e) => setRecipientContact(e.target.value)}
                placeholder="Optional"
              />
            </>
          )}

          {(preset === 'custom' || preset === 'recurring') && (
            <>
              <label className="field-label" style={{ marginTop: 12 }}>Starts</label>
              <input type="datetime-local" value={activatesAt} onChange={(e) => setActivatesAt(e.target.value)} />
            </>
          )}

          {preset !== 'full_day' && (
            <>
              <label className="field-label" style={{ marginTop: 12 }}>
                {preset === 'recurring' ? 'Ends (optional)' : 'Ends'}
              </label>
              <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </>
          )}

          {preset === 'recurring' && (
            <>
              <label className="field-label" style={{ marginTop: 12 }}>Days</label>
              <div className="day-picker">
                {DAY_LABELS.map((label, i) => (
                  <button
                    type="button"
                    key={label}
                    className={`day-chip${daysOfWeek.includes(i) ? ' selected' : ''}`}
                    onClick={() => toggleDay(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label">From</label>
                  <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Until</label>
                  <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {error && <p className="error">{error}</p>}
          <div className="sheet-actions">
            <button type="button" className="btn-text" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Creating\u2026' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PinRevealSheet({
  recipientName, code, onClose,
}: { recipientName: string; code: string; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <h3>Delivery Pass created</h3>
        <p className="muted" style={{ marginBottom: 12 }}>
          Share this code with {recipientName} — it's only shown once.
        </p>
        <div className="pin-reveal">{code}</div>
        <div className="sheet-actions">
          <button
            className="btn-text"
            onClick={() => { navigator.clipboard.writeText(code); }}
          >
            Copy
          </button>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
