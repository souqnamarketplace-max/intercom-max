import { Preferences } from '@capacitor/preferences';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const TOKEN_KEY = 'resident_access_token';

// Preferences (not localStorage) is used because Capacitor apps run in a
// WebView whose storage can be cleared more aggressively by the OS than a
// desktop browser's — Preferences persists reliably across app restarts.
export async function setToken(token: string) {
  await Preferences.set({ key: TOKEN_KEY, value: token });
}

export async function getToken(): Promise<string | null> {
  const { value } = await Preferences.get({ key: TOKEN_KEY });
  return value;
}

export async function clearToken() {
  await Preferences.remove({ key: TOKEN_KEY });
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, body.message || 'Something went wrong');
  }
  return body as T;
}

export interface RequestOtpResponse {
  message: string;
  devOtp?: string; // only present outside production — see backend resident-auth.service.ts
}

export interface VerifyOtpResponse {
  accessToken: string;
  resident: { id: string; name: string; unitId: string };
}

export interface ResidentMe {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  unitId: string;
  unitNumber: string;
  siteId: string;
  siteName: string;
  notificationsEnabled: boolean;
  hasDoorPin: boolean;
}

export interface VirtualKey {
  id: string;
  unitId: string;
  siteId: string;
  recipientName: string;
  recipientContact?: string | null;
  keyType: 'single_use' | 'recurring' | 'delivery';
  accessMethod: 'qr' | 'pin';
  status: 'active' | 'revoked' | 'expired';
  signedToken: string;
  activatesAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  rawShortCode?: string; // only present on the create response, never again after
}

export type PassPreset = 'custom' | 'recurring' | 'business_hours' | 'full_day';

export interface AuditEvent {
  id: string;
  eventType: string;
  method: string | null;
  result: string;
  photoUrl?: string | null;
  createdAt: string;
}

export interface ResidentMessage {
  id: string;
  body: string;
  photoUrl?: string | null;
  readAt: string | null;
  createdAt: string;
}

export const api = {
  requestOtp: (inviteCode: string) =>
    request<RequestOtpResponse>('/resident-auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    }),

  verifyOtp: (inviteCode: string, otp: string) =>
    request<VerifyOtpResponse>('/resident-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ inviteCode, otp }),
    }),

  getMe: () => request<ResidentMe>('/residents/me', {}, true),
  updateMe: (data: { email?: string; phone?: string; notificationsEnabled?: boolean }) =>
    request<Partial<ResidentMe>>('/residents/me', { method: 'PATCH', body: JSON.stringify(data) }, true),
  setDoorPin: (pin: string) =>
    request<{ hasDoorPin: boolean }>('/residents/me/pin', { method: 'POST', body: JSON.stringify({ pin }) }, true),

  // Visitor Pass (QR, scanned at panel camera) / Delivery Pass (PIN, typed
  // on panel keypad) — resident self-service generation, no staff needed.
  // preset mirrors the reference product's four preset buttons; only
  // 'custom' and 'recurring' need extra fields from the caller.
  listMyPasses: () => request<VirtualKey[]>('/residents/me/visitor-passes', {}, true),
  createMyPass: (data: {
    recipientName: string; recipientContact?: string;
    keyType: 'single_use' | 'recurring' | 'delivery'; accessMethod: 'qr' | 'pin';
    preset: PassPreset;
    activatesAt?: string; expiresAt?: string;
    schedule?: { daysOfWeek: number[]; timeStart: string; timeEnd: string };
  }) => request<VirtualKey>('/residents/me/visitor-passes', { method: 'POST', body: JSON.stringify(data) }, true),
  revokeMyPass: (id: string) =>
    request<VirtualKey>(`/residents/me/visitor-passes/${id}/revoke`, { method: 'PATCH' }, true),

  // Activity feed — everything tied to the resident's unit (any household
  // member's access), cursor-paginated.
  getMyActivity: (cursor?: string) =>
    request<{ events: AuditEvent[]; nextCursor: string | null }>(
      `/residents/me/activity${cursor ? `?cursor=${cursor}` : ''}`, {}, true,
    ),

  // "Swipe to Open" quick-unlock from Home. Logs a real audit event now;
  // actually triggering a relay needs a Pi, which doesn't exist yet.
  openDoor: (entryPointId: string, photoUrl?: string) =>
    request<AuditEvent>(`/residents/me/open-door/${entryPointId}`, {
      method: 'POST',
      body: JSON.stringify({ photoUrl }),
    }, true),

  // Doors this resident can actually reach: shared spaces open to everyone
  // plus anything explicitly granted to their unit's zone.
  getMyAccessPoints: () =>
    request<{ id: string; name: string }[]>('/residents/me/access-points', {}, true),

  // Messages a panel visitor left — the backend endpoint has existed since
  // the panel's Messages feature shipped, but the resident app never had
  // an inbox screen to actually read them.
  getMyMessages: () =>
    request<ResidentMessage[]>('/residents/me/messages', {}, true),
};
