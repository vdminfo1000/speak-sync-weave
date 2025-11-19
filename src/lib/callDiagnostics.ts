/**
 * Утилиты для диагностики WebRTC соединений
 */

export interface CallDiagnostics {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
  localDescription: boolean;
  remoteDescription: boolean;
  localCandidates: number;
  remoteCandidates: number;
}

export async function getDiagnostics(pc: RTCPeerConnection): Promise<CallDiagnostics> {
  const stats = await pc.getStats();
  let localCandidates = 0;
  let remoteCandidates = 0;

  stats.forEach((stat) => {
    if (stat.type === 'local-candidate') localCandidates++;
    if (stat.type === 'remote-candidate') remoteCandidates++;
  });

  return {
    connectionState: pc.connectionState,
    iceConnectionState: pc.iceConnectionState,
    iceGatheringState: pc.iceGatheringState,
    signalingState: pc.signalingState,
    localDescription: !!pc.localDescription,
    remoteDescription: !!pc.currentRemoteDescription,
    localCandidates,
    remoteCandidates,
  };
}

export function logDiagnostics(diagnostics: CallDiagnostics, prefix: string) {
  console.log(`[${prefix}] 🔍 Connection Diagnostics:`, {
    connection: diagnostics.connectionState,
    ice: diagnostics.iceConnectionState,
    gathering: diagnostics.iceGatheringState,
    signaling: diagnostics.signalingState,
    descriptions: {
      local: diagnostics.localDescription,
      remote: diagnostics.remoteDescription,
    },
    candidates: {
      local: diagnostics.localCandidates,
      remote: diagnostics.remoteCandidates,
    },
  });
}

export async function diagnoseConnection(pc: RTCPeerConnection, prefix: string) {
  const diagnostics = await getDiagnostics(pc);
  logDiagnostics(diagnostics, prefix);
  return diagnostics;
}
