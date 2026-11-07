import { useState, useEffect, useRef } from 'react';
import { realtimeRelay } from '../utils/realtimeRelay';

export function useMerchantRelay(merchantId, user, onNewJob) {
  const [isRelayConnected, setIsRelayConnected] = useState(false);
  const [relayNotice, setRelayNotice] = useState(null);

  const onNewJobRef = useRef(onNewJob);
  const userRef = useRef(user);

  useEffect(() => {
    onNewJobRef.current = onNewJob;
    userRef.current = user;
  });

  const userId = user?.uid;

  useEffect(() => {
    if (!merchantId) return;

    let isMounted = true;

    realtimeRelay.setTokenProvider(async () => {
      const currentUser = userRef.current;
      if (currentUser && typeof currentUser.getIdToken === 'function') {
        try {
          return await currentUser.getIdToken();
        } catch (e) {
          console.warn('Token refresh error:', e);
        }
      }
      return null;
    });

    const init = async () => {
      let token = null;
      const currentUser = userRef.current;
      if (currentUser && typeof currentUser.getIdToken === 'function') {
        try {
          token = await currentUser.getIdToken();
        } catch (e) {
          console.warn('Token retrieval error:', e);
        }
      }
      if (isMounted) {
        realtimeRelay.connect(merchantId, 'merchant', token);
      }
    };

    init();

    const unsubscribe = realtimeRelay.subscribe((event) => {
      if (!isMounted) return;

      if (event.type === 'connection_change') {
        setIsRelayConnected(Boolean(event.connected));
      } else if (event.type === 'session_replaced') {
        setRelayNotice({
          message: 'Relay paused: Dashboard open in another window',
          severity: 'warning',
        });
      } else if (event.type === 'transfer_start') {
        setRelayNotice({
          message: `Receiving document: ${event.fileName}`,
          severity: 'info',
        });
      } else if (event.type === 'job_submitted') {
        setRelayNotice({
          message: 'New job received from customer',
          severity: 'info',
        });
        if (typeof onNewJobRef.current === 'function') {
          onNewJobRef.current();
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      realtimeRelay.disconnect();
    };
  }, [merchantId, userId]);

  return {
    isRelayConnected,
    relayNotice,
    clearRelayNotice: () => setRelayNotice(null),
  };
}

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
}

export function playChime() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Browser audio policy prevented autoplay
  }
}
