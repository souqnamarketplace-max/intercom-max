import { useState } from 'react';
import { api, setToken } from '../api/client';

interface Props {
  onLoggedIn: () => void;
}

// Two-step login: invite code (given by the property manager at move-in) ->
// OTP sent to the resident's phone/email -> verify -> JWT stored.
export default function Login({ onLoggedIn }: Props) {
  const [step, setStep] = useState<'code' | 'otp'>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestOtp(inviteCode.trim());
      setDevOtp(res.devOtp ?? null); // only ever set outside production
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.verifyOtp(inviteCode.trim(), otp.trim());
      await setToken(res.accessToken);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect or expired code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen center">
      <div className="keyplate" key={step}>
        <p className="eyebrow">Resident Access</p>
        <h1>{step === 'code' ? 'Enter your building' : 'Confirm it\u2019s you'}</h1>
        <p className="muted">
          {step === 'code'
            ? 'Use the invite code your property manager gave you.'
            : 'Enter the 6-digit code we sent you.'}
        </p>

        {step === 'code' && (
          <form onSubmit={handleRequestOtp}>
            <label className="field-label" htmlFor="inviteCode">Invite code</label>
            <input
              id="inviteCode"
              className="input"
              placeholder="e.g. 28e8391308e6"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              autoCapitalize="none"
              autoFocus
              required
            />
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Sending\u2026' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <label className="field-label" htmlFor="otp">6-digit code</label>
            <input
              id="otp"
              className="input"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoFocus
              required
            />
            {devOtp && (
              <p className="readout">Testing mode {'\u2014'} code is <strong>{devOtp}</strong></p>
            )}
            {error && <p className="error">{error}</p>}
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Verifying\u2026' : 'Verify'}
            </button>
            <button className="btn-text" type="button" onClick={() => setStep('code')}>
              Use a different code
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
