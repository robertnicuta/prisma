// Remote content receives no filesystem or general-purpose IPC bridge.
const { ipcRenderer } = require('electron');
let peer, pending = [], busy = false, lastMedia = '';
ipcRenderer.on('vdo-signal', async (_, packet) => {
  try {
    if (packet.type === 'answer') {
      await peer.setRemoteDescription(packet.description);
      for (const candidate of pending.splice(0)) await peer.addIceCandidate(candidate);
    } else if (packet.type === 'ice') {
      if (peer?.remoteDescription) await peer.addIceCandidate(packet.candidate);
      else pending.push(packet.candidate);
    }
  } catch (e) { ipcRenderer.send('vdo-signal', { type: 'error', message: e.message }); }
});
ipcRenderer.on('vdo-start', async () => {
  peer?.close(); pending = []; lastMedia = '';
  peer = new RTCPeerConnection({ iceServers: [] });
  peer.addTransceiver('video', { direction: 'sendonly' });
  peer.addTransceiver('audio', { direction: 'sendonly' });
  peer.onicecandidate = e => e.candidate && ipcRenderer.send('vdo-signal', { type: 'ice', candidate: e.candidate.toJSON() });
});
setInterval(async () => {
  if (!peer || busy) return;
  busy = true;
  try {
    const elements = [...document.querySelectorAll('video, audio')];
    const tracks = elements.flatMap(el => {
      // Keep Chromium's audio decoder active without speaker monitoring.
      el.muted = false; el.volume = 0;
      if (el.paused && el.srcObject) el.play().catch(() => {});
      return el.srcObject?.getTracks?.() || [];
    }).filter(t => t.readyState === 'live');
    const media = {};
    for (const [i, kind] of ['video', 'audio'].entries()) {
      const track = tracks.find(t => t.kind === kind) || null;
      const sender = peer.getTransceivers()[i].sender;
      if (sender.track !== track) await sender.replaceTrack(track);
      media[kind] = !!track && !track.muted && track.enabled;
    }
    if (!peer.localDescription && tracks.length) {
      await peer.setLocalDescription(await peer.createOffer());
      ipcRenderer.send('vdo-signal', { type: 'offer', description: peer.localDescription.toJSON() });
    }
    const value = JSON.stringify(media);
    if (value !== lastMedia) { lastMedia = value; ipcRenderer.send('vdo-signal', { type: 'media', ...media }); }
  } catch (e) { ipcRenderer.send('vdo-signal', { type: 'error', message: e.message }); }
  finally { busy = false; }
}, 500);
