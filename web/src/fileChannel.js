import { socket } from './api';
import { saveImage } from './imageStore';

const ICE    = [{ urls: 'stun:stun.l.google.com:19302' }];
const CHUNK  = 16384;   // 16 KB
const END    = '\x00END\x00';
const TIMEOUT_MS = 12000;

const pcs = new Map();  // userId → RTCPeerConnection

// Called once when ChatScreen mounts. Returns unsubscribe fn.
export function initFileReceiver(onReceived) {
  const u1 = socket.on('file:offer', async ({ fromUserId, fileId, sdp }) => {
    const pc = ensurePC(fromUserId);
    pc.ondatachannel = ({ channel }) => receiveChannel(channel, fileId, onReceived);
    await pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.send('file:answer', { toUserId: fromUserId, fileId, sdp: answer.sdp });
  });

  const u2 = socket.on('file:answer', async ({ fromUserId, sdp }) => {
    await pcs.get(fromUserId)?.setRemoteDescription({ type: 'answer', sdp });
  });

  const u3 = socket.on('file:ice', async ({ fromUserId, candidate }) => {
    try { await pcs.get(fromUserId)?.addIceCandidate(candidate); } catch {}
  });

  return () => { u1(); u2(); u3(); };
}

// Returns dataUrl on success, throws on failure (caller falls back to server)
export function sendFileP2P(toUserId, fileId, dataUrl) {
  return new Promise(async (resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('P2P timeout')), TIMEOUT_MS);

    const pc      = ensurePC(toUserId);
    const channel = pc.createDataChannel('f');
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      clearTimeout(timer);
      try {
        // Strip data URL header, decode base64 → binary chunks
        const b64    = dataUrl.split(',')[1];
        const binary = atob(b64);
        for (let i = 0; i < binary.length; i += CHUNK) {
          const slice = binary.slice(i, i + CHUNK);
          const buf   = new Uint8Array(slice.length);
          for (let j = 0; j < slice.length; j++) buf[j] = slice.charCodeAt(j);
          channel.send(buf.buffer);
        }
        channel.send(END);
        resolve();
      } catch (e) { reject(e); }
    };

    channel.onerror = e => { clearTimeout(timer); reject(e); };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.send('file:offer', { toUserId, fileId, sdp: offer.sdp });
    } catch (e) { clearTimeout(timer); reject(e); }
  });
}

// ── internals ──────────────────────────────────────────────────────────────

function ensurePC(userId) {
  if (pcs.has(userId)) return pcs.get(userId);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  pcs.set(userId, pc);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.send('file:ice', { toUserId: userId, candidate });
  };
  pc.onconnectionstatechange = () => {
    if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
      pcs.delete(userId);
      pc.close();
    }
  };
  return pc;
}

function receiveChannel(channel, fileId, onReceived) {
  const chunks = [];
  channel.binaryType = 'arraybuffer';

  channel.onmessage = ({ data }) => {
    if (typeof data === 'string' && data === END) {
      // Reassemble binary → dataUrl
      const blob   = new Blob(chunks);
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target.result;
        saveImage(fileId, dataUrl)
          .then(() => onReceived(fileId, dataUrl))
          .catch(console.error);
      };
      reader.readAsDataURL(blob);
    } else {
      chunks.push(data);
    }
  };
}
