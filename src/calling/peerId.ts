// Must exactly match the panel's peerIdForResident() convention — this is
// how the panel finds this resident to place a call, via PeerJS's public
// broker (no custom signaling backend for this test phase).
export function peerIdForResident(residentId: string): string {
  return `intercom-resident-${residentId}`;
}
