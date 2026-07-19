import { useEffect, useRef, useState } from 'react';
import Peer, { type MediaConnection, type DataConnection } from 'peerjs';
import { peerIdForResident } from '../calling/peerId';
import { Ringtone } from '../calling/ringtone';
import { api } from '../api/client';

type CallState = 'idle' | 'ringing' | 'connected';
type DoorState = 'idle' | 'opening' | 'opened' | 'failed';

interface IncomingCallProps {
  // Passed down from App.tsx's already-fetched/verified `me`, instead of
  // this component independently re-fetching its own copy of "who am I".
  // The old approach called api.getMe() a second time on mount, wrapped in
  // a silent .catch(() => {}) — if that particular fetch failed for any
  // reason (a timing race on mount, a transient network hiccup), incoming
  // calls would be permanently broken for the whole session with zero
  // visible sign of it, since the rest of the app (fed by App.tsx's own
  // successful getMe()) looked completely normal. Reusing the same verified
  // id removes that entire failure surface.
  residentId: string | null;
}

export default function IncomingCall({ residentId }: IncomingCallProps) {
  const peerRef = useRef<Peer | null>(null);
  const activeCallRef = useRef<MediaConnection | null>(null);
  const dataConnRef = useRef<DataConnection | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef(new Ringtone());
  const [state, setState] = useState<CallState>('idle');
  const [callerLabel, setCallerLabel] = useState('Front Door');
  const [callEntryPointId, setCallEntryPointId] = useState<string | null>(null);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [doorState, setDoorState] = useState<DoorState>('idle');
  // Surfaces registration problems instead of the old silent failure —
  // shown as a small persistent badge (see bottom of this file) so it's
  // visible even though this component renders null while idle.
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // A silent incoming call is easy to miss - previously there was no audio
  // cue at all, purely a visual overlay.
  useEffect(() => {
    if (state === 'ringing') ringtoneRef.current.start();
    else ringtoneRef.current.stop();
    return () => ringtoneRef.current.stop();
  }, [state]);

  useEffect(() => {
    if (!residentId) return;

    let cancelled = false;
    let peer: Peer | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    function connect() {
      if (cancelled) return;
      const peerId = peerIdForResident(residentId!);
      peer = new Peer(peerId, {
        host: 'intercom-peerjs-server-production.up.railway.app',
        path: '/peerjs',
        secure: true,
        port: 443,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });
      peerRef.current = peer;

      peer.on('open', () => {
        if (cancelled) return;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        attempt = 0;
        setRegistrationError(null);
        console.log(`[IncomingCall] registered on broker as ${peerId}`);
      });

      peer.on('error', (err) => {
        if (cancelled) return;
        console.error('[IncomingCall] PeerJS error', err.type, err.message);
        // 'peer-unavailable' = panel called a non-existent resident, not our problem
        // 'unavailable-id' = ID clash, retry immediately with a fresh ID
        if (err.type === 'peer-unavailable') return;
        setRegistrationError('Reconnecting…');
        scheduleReconnect();
      });

      peer.on('disconnected', () => {
        if (cancelled) return;
        // Broker dropped the connection (idle timeout, network blip, etc.)
        // Try to reconnect to the same broker first before destroying.
        console.warn('[IncomingCall] disconnected from broker, reconnecting…');
        peer?.reconnect();
        // If reconnect() doesn't fire 'open' within 5s, do a full re-init.
        reconnectTimer = setTimeout(() => {
          if (cancelled) return;
          peer?.destroy();
          scheduleReconnect();
        }, 5000);
      });

      peer.on('open', () => {
        // Clear the 5s fallback timer if reconnect() succeeded on its own
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      });

      peer.on('call', (call) => {
        console.log('[IncomingCall] CALL EVENT FIRED from', call.peer, 'metadata:', call.metadata);
        activeCallRef.current = call;
        const metadata = call.metadata as { from?: string; entryPointId?: string } | undefined;
        setCallerLabel(metadata?.from ?? 'Front Door');
        setCallEntryPointId(metadata?.entryPointId ?? null);
        setState('ringing');
        call.on('close', () => setState('idle'));
        call.on('error', () => setState('idle'));
      });

      peer.on('connection', (conn) => {
        dataConnRef.current = conn;
        conn.on('data', (data) => {
          const msg = data as { type?: string };
          if (msg?.type === 'cancelled') setState('idle');
        });
      });
    }

    function scheduleReconnect() {
      if (cancelled) return;
      attempt += 1;
      // Exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      console.log(`[IncomingCall] scheduling reconnect in ${delay}ms (attempt ${attempt})`);
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      peer?.destroy();
    };
  }, [residentId]);

  // Per the decided call flow: resident always hears/sees the visitor —
  // whether the resident sends their own video back is fixed at answer
  // time (PeerJS connections can't be renegotiated after answering).
  async function answer(withOwnCamera: boolean) {
    const call = activeCallRef.current;
    if (!call) return;
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: withOwnCamera,
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    call.answer(localStream);
    call.on('stream', (remoteStream) => {
      // NOTE: the <video> element for the 'connected' state doesn't exist
      // in the DOM yet at this point — this handler fires before the
      // setState('connected') below has re-rendered. Attaching directly to
      // remoteVideoRef.current here was a no-op bug (ref was always null).
      // Instead, stash the stream and let the effect below attach it once
      // the video element actually mounts.
      remoteStreamRef.current = remoteStream;
      setState('connected');
    });
  }

  // Attaches the stashed remote stream once the <video> element exists
  // (i.e. after 'connected' has rendered), and handles the case where
  // .play() gets blocked by the browser's autoplay policy because we're
  // outside the original click's user-gesture context by the time the
  // async 'stream' event actually fires.
  useEffect(() => {
    if (state !== 'connected') return;
    const video = remoteVideoRef.current;
    const stream = remoteStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => setNeedsTapToPlay(true));
  }, [state]);

  function resumePlayback() {
    remoteVideoRef.current?.play()
      .then(() => setNeedsTapToPlay(false))
      .catch(() => {
        // Still blocked — leave the tap-to-play button up.
      });
  }

  // Reuses the same access-checked endpoint as the Home screen's "My
  // Access" list — the caller's entry point ID comes straight from the
  // call metadata, so no extra lookup is needed. Per ButterflyMX-parity,
  // the resident can open the door directly from an active call.
  // Reuses the same access-checked endpoint as the Home screen's "My
  // Access" list — the caller's entry point ID comes straight from the
  // call metadata, so no extra lookup is needed. Per ButterflyMX-parity,
  // the resident can open the door directly from an active call. Captures
  // a snapshot of the visitor from the live remote video first, so the
  // audit trail shows who was actually let in, not just that a door opened.
  async function unlockDoor() {
    if (!callEntryPointId) return;
    setDoorState('opening');
    try {
      const photoUrl = captureVisitorSnapshot();
      await api.openDoor(callEntryPointId, photoUrl);
      setDoorState('opened');
      // Unlocking ends the call and tells the panel specifically why, so
      // it can show "X is open, please enter" instead of a generic
      // "call ended" - previously the call just kept running afterward
      // with no visible confirmation on the panel side at all.
      if (dataConnRef.current?.open) {
        dataConnRef.current.send({ type: 'door_opened' });
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      activeCallRef.current?.close();
      dataConnRef.current?.close();
      remoteStreamRef.current = null;
      setCallEntryPointId(null);
      setTimeout(() => { setDoorState('idle'); setState('idle'); }, 1500);
    } catch {
      setDoorState('failed');
      setTimeout(() => setDoorState('idle'), 2500);
    }
  }

  function captureVisitorSnapshot(): string | undefined {
    const video = remoteVideoRef.current;
    if (!video || video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) return undefined;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  async function sendControlAndClose(type: 'declined' | 'ended') {
    if (dataConnRef.current?.open) {
      dataConnRef.current.send({ type });
      // Same race as the panel side - send() only queues the message,
      // closing the connection immediately after can drop it before it
      // actually transmits.
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    dataConnRef.current?.close();
  }

  function decline() {
    sendControlAndClose('declined');
    activeCallRef.current?.close();
    setState('idle');
  }

  function hangUp() {
    sendControlAndClose('ended');
    activeCallRef.current?.close();
    remoteStreamRef.current = null;
    setNeedsTapToPlay(false);
    setCallEntryPointId(null);
    setDoorState('idle');
    setState('idle');
  }

  if (state === 'idle') {
    // Small persistent badge so a broken call registration is visible
    // instead of indistinguishable from "everything's fine, just no calls
    // right now" — this was the whole problem with the old silent failure.
    if (registrationError) {
      return (
        <div className="incoming-call-error-badge" title={registrationError}>
          ⚠ Calls unavailable
        </div>
      );
    }
    return null;
  }

  return (
    <div className="incoming-call-overlay">
      {state === 'ringing' && (
        <div className="incoming-call-card">
          <div className="incoming-avatar">🔔</div>
          <p className="incoming-title">Someone's at the door</p>
          <p className="incoming-sub">{callerLabel}</p>
          <div className="incoming-actions">
            <button className="incoming-btn decline" onClick={decline}>Decline</button>
            <button className="incoming-btn answer" onClick={() => answer(false)}>Answer</button>
          </div>
          <button className="incoming-link" onClick={() => answer(true)}>Answer with my camera on</button>
        </div>
      )}

      {state === 'connected' && (
        <div className="incoming-call-card wide">
          <video ref={remoteVideoRef} autoPlay playsInline className="incoming-remote-video" />
          {needsTapToPlay && (
            <button className="incoming-btn answer" onClick={resumePlayback}>
              Tap to enable video/audio
            </button>
          )}
          <p className="incoming-sub">{callerLabel}</p>
          <div className="incoming-actions">
            <button className="incoming-btn decline" onClick={hangUp}>End call</button>
            <button
              className="incoming-btn answer"
              onClick={unlockDoor}
              disabled={!callEntryPointId || doorState === 'opening'}
              title={!callEntryPointId ? 'This call didn\u2019t report a door — try again' : undefined}
            >
              {doorState === 'opening' ? 'Opening\u2026'
                : doorState === 'opened' ? 'Door Opened'
                : doorState === 'failed' ? 'Try Again'
                : 'Unlock Door'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
