// src/utils/realtimeRelay.js
/**
 * QuickPrint Real-Time WebSocket Client for Cloudflare Durable Objects Relay.
 * Handles 64KB binary chunk streaming, presence monitoring, and automatic reconnection.
 */

import { saveJobBlob } from './localJobStorage';

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const PING_INTERVAL_MS = 25000; // 25s keepalive ping
const MAX_BUFFERED_AMOUNT = 512 * 1024; // 512 KB backpressure threshold

/**
 * Resolve WebSocket URL for Cloudflare Relay
 */
export function getRelayWsUrl(shopId, role = 'customer') {
  let baseUrl = import.meta.env.VITE_CF_RELAY_URL || 'wss://quickprint-relay.workers.dev';

  // Normalize protocol
  if (baseUrl.startsWith('http://')) {
    baseUrl = 'ws://' + baseUrl.substring(7);
  } else if (baseUrl.startsWith('https://')) {
    baseUrl = 'wss://' + baseUrl.substring(8);
  } else if (!baseUrl.startsWith('ws://') && !baseUrl.startsWith('wss://')) {
    baseUrl = 'wss://' + baseUrl;
  }

  // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, '');

  const url = new URL(`${baseUrl}/room`);
  url.searchParams.set('shopId', shopId);
  url.searchParams.set('role', role);
  // Do NOT add token to URL query parameter to prevent exposure in logs and browser history.
  // Auth token will be sent in post-connection handshake envelope { type: 'auth', token }.

  return url.toString();
}

export class RealtimeRelay {
  constructor() {
    this.ws = null;
    this.shopId = null;
    this.role = null;
    this.listeners = new Set();
    this.merchantOnline = false;
    this.isConnected = false;
    this.pingTimer = null;
    this.reconnectTimer = null;
    this.shouldReconnect = true;
    this.retryCount = 0;
    this.tokenProvider = null;

    // Incoming file assembly state (for merchant receiver)
    // Key: `${jobId}_${fileIndex}`
    this.activeTransfers = new Map();

    // Lazy browser network recovery listener (registered only when connected)
    this.boundOnlineHandler = null;
  }

  /**
   * Set dynamic token provider callback for refreshing merchant auth tokens on reconnect
   * @param {() => Promise<string|null>} fn
   */
  setTokenProvider(fn) {
    this.tokenProvider = fn;
  }

  /**
   * Subscribe to relay events
   * @param {Function} listener ({ type, payload }) => void
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    // Send immediate initial state
    listener({
      type: 'presence',
      online: this.merchantOnline,
      connected: this.isConnected,
    });
    return () => this.listeners.delete(listener);
  }

  notify(event) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in relay listener:', err);
      }
    }
  }

  /**
   * Ensure relay WebSocket is connected before streaming
   * @param {string} shopId
   * @param {'merchant'|'customer'} role
   * @param {string|null} token
   * @param {number} timeoutMs
   * @returns {Promise<boolean>}
   */
  async ensureConnected(shopId, role = 'customer', token = null, timeoutMs = 8000) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.shopId === shopId && this.role === role) {
      return true;
    }

    this.connect(shopId, role, token);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Connection to real-time relay timed out'));
      }, timeoutMs);

      const cleanup = this.subscribe((event) => {
        if (event.type === 'connection_change' && event.connected) {
          clearTimeout(timer);
          cleanup();
          resolve(true);
        }
      });
    });
  }

  /**
   * Connect to Cloudflare Durable Object room
   * @param {string} shopId - Merchant ID
   * @param {'merchant'|'customer'} role
   * @param {string|null} token - Optional Firebase ID token (required for merchant)
   */
  async connect(shopId, role = 'customer', token = null) {
    if (!shopId) return;

    let authToken = token;
    if (!authToken && this.tokenProvider && role === 'merchant') {
      try {
        authToken = await this.tokenProvider();
      } catch (err) {
        console.warn('Could not retrieve token from tokenProvider:', err);
      }
    }
    if (!authToken && this.token && role === 'merchant') {
      authToken = this.token;
    }

    // If already connected to same room, role, and token, return
    if (this.ws && this.shopId === shopId && this.role === role && this.token === authToken && this.isConnected) {
      return;
    }

    this.disconnect();
    this.shopId = shopId;
    this.role = role;
    this.token = authToken;
    this.shouldReconnect = true;

    // Lazily register online event listener when connection is established/requested
    if (typeof window !== 'undefined' && !this.boundOnlineHandler) {
      this.boundOnlineHandler = async () => {
        if (this.shouldReconnect && this.shopId && !this.isConnected) {
          this.retryCount = 0;
          let freshToken = null;
          if (this.tokenProvider && this.role === 'merchant') {
            try {
              freshToken = await this.tokenProvider();
            } catch (err) {
              console.warn('Failed to retrieve fresh token on online event:', err);
            }
          }
          this.connect(this.shopId, this.role, freshToken || this.token);
        }
      };
      window.addEventListener('online', this.boundOnlineHandler);
    }

    const wsUrl = getRelayWsUrl(shopId, role);

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.isConnected = true;
        this.retryCount = 0; // Reset backoff on successful handshake
        this.startHeartbeat();

        // Send auth envelope if connecting as merchant (Fixes Issue 2.3: token in URL query)
        if (this.role === 'merchant' && this.token) {
          try {
            this.ws.send(JSON.stringify({ type: 'auth', token: this.token }));
          } catch (err) {
            console.error('Failed to send auth envelope over relay WebSocket:', err);
          }
        }

        this.notify({
          type: 'connection_change',
          connected: true,
          shopId: this.shopId,
          role: this.role,
        });
      };

      this.ws.onmessage = async (event) => {
        if (typeof event.data === 'string') {
          this.handleTextMessage(event.data);
        } else if (event.data instanceof ArrayBuffer) {
          this.handleBinaryMessage(event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        this.stopHeartbeat();
        this.notify({
          type: 'connection_change',
          connected: false,
          code: event.code,
          reason: event.reason,
        });

        // Code 4001: Session closed because newer dashboard tab connected.
        // Code 4401: Unauthorized merchant session.
        if (event.code === 4001 || event.code === 4401) {
          this.shouldReconnect = false;
          this.notify({
            type: event.code === 4001 ? 'session_replaced' : 'auth_error',
            message: event.reason || (event.code === 4001 ? 'Relay session closed: Dashboard opened in another tab.' : 'Unauthorized merchant session'),
          });
          return;
        }

        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('RealtimeRelay WebSocket error:', err);
      };
    } catch (err) {
      console.error('Failed to establish RealtimeRelay connection:', err);
      this.scheduleReconnect();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // ignore
        }
      }
    }, PING_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect) return;

    // Cap automatic reconnect attempts to 5 when offline to protect Cloudflare request quota
    if (this.retryCount >= 5) {
      this.notify({
        type: 'connection_change',
        connected: false,
        status: 'offline',
      });
      return;
    }

    const delay = Math.min(30000, 3000 * Math.pow(1.5, this.retryCount));
    this.retryCount++;

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (this.shouldReconnect && this.shopId) {
        let freshToken = null;
        if (this.tokenProvider && this.role === 'merchant') {
          try {
            freshToken = await this.tokenProvider();
          } catch (err) {
            console.warn('Failed to retrieve fresh token on reconnect:', err);
          }
        }
        this.connect(this.shopId, this.role, freshToken || this.token);
      }
    }, delay);
  }

  disconnect() {
    this.shouldReconnect = false;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    if (typeof window !== 'undefined' && this.boundOnlineHandler) {
      window.removeEventListener('online', this.boundOnlineHandler);
      this.boundOnlineHandler = null;
    }
    this.isConnected = false;
    this.merchantOnline = false;
  }

  /**
   * Handle text JSON envelopes
   */
  async handleTextMessage(text) {
    try {
      const data = JSON.parse(text);

      if (data.type === 'pong') {
        return;
      }

      if (data.type === 'auth_success') {
        this.notify({
          type: 'auth_success',
        });
        return;
      }

      if (data.type === 'auth_error') {
        console.warn('RealtimeRelay merchant auth failed:', data.reason);
        this.notify({
          type: 'auth_error',
          reason: data.reason,
        });
        return;
      }

      if (data.type === 'session_replaced') {
        this.shouldReconnect = false;
        this.notify({
          type: 'session_replaced',
          message: data.message || 'Relay session closed: Dashboard opened in another tab.',
        });
        return;
      }

      if (data.type === 'merchant_presence') {
        const isOnline = !!(data.online ?? data.presence);
        this.merchantOnline = isOnline;
        this.notify({
          type: 'presence',
          online: isOnline,
        });
        return;
      }

      // Receiver handling file streaming envelopes
      if (data.type === 'file_start') {
        const transferKey = `${data.jobId}_${data.fileIndex}`;
        
        // Clear any previous timeout if duplicate start received
        const existing = this.activeTransfers.get(transferKey);
        if (existing?.timeoutId) clearTimeout(existing.timeoutId);

        // Auto-cleanup stale transfer if file_end never arrives within 2 minutes
        const timeoutId = setTimeout(() => {
          if (this.activeTransfers.has(transferKey)) {
            this.activeTransfers.delete(transferKey);
            this.notify({
              type: 'transfer_error',
              jobId: data.jobId,
              fileIndex: data.fileIndex,
              error: 'File transfer timed out',
            });
          }
        }, 120000);

        this.activeTransfers.set(transferKey, {
          meta: data,
          chunks: [],
          receivedBytes: 0,
          timeoutId,
        });
        this.notify({
          type: 'transfer_start',
          jobId: data.jobId,
          fileIndex: data.fileIndex,
          fileName: data.fileName,
          fileSize: data.fileSize,
        });
        return;
      }

      if (data.type === 'file_end') {
        const transferKey = `${data.jobId}_${data.fileIndex}`;
        const transfer = this.activeTransfers.get(transferKey);

        if (transfer) {
          if (transfer.timeoutId) clearTimeout(transfer.timeoutId);
          const blob = new Blob(transfer.chunks, { type: transfer.meta.mimeType || 'application/octet-stream' });
          // Persist received blob directly into merchant IndexedDB
          try {
            await saveJobBlob(data.jobId, data.fileIndex, blob);
          } catch (dbErr) {
            console.error('Error saving received blob to IndexedDB:', dbErr);
          }

          this.activeTransfers.delete(transferKey);

          this.notify({
            type: 'transfer_complete',
            jobId: data.jobId,
            fileIndex: data.fileIndex,
            fileName: transfer.meta.fileName,
            blob,
            specs: transfer.meta.specs,
          });
        }
        return;
      }

      if (data.type === 'job_submitted') {
        this.notify({
          type: 'job_submitted',
          jobId: data.jobId,
          jobData: data.jobData,
        });
        return;
      }

      // Forward any other custom envelope
      this.notify({
        type: 'custom_message',
        payload: data,
      });
    } catch (err) {
      console.warn('Failed to parse text message from relay:', err);
    }
  }

  /**
   * Handle incoming binary chunks (receiver side)
   * Decodes self-describing binary frame: [1 byte: keyLen] [keyLen bytes: transferKey] [raw payload]
   */
  handleBinaryMessage(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 2) return;

    const keyLen = bytes[0];
    if (bytes.length <= 1 + keyLen) return;

    const keyBytes = bytes.subarray(1, 1 + keyLen);
    const transferKey = new TextDecoder().decode(keyBytes);
    const rawChunk = bytes.subarray(1 + keyLen);

    const transfer = this.activeTransfers.get(transferKey);
    if (transfer) {
      transfer.chunks.push(rawChunk);
      transfer.receivedBytes += rawChunk.byteLength;

      const progress = transfer.meta.fileSize > 0
        ? Math.min(100, (transfer.receivedBytes / transfer.meta.fileSize) * 100)
        : 100;

      this.notify({
        type: 'transfer_progress',
        jobId: transfer.meta.jobId,
        fileIndex: transfer.meta.fileIndex,
        fileName: transfer.meta.fileName,
        progress,
        receivedBytes: transfer.receivedBytes,
        totalBytes: transfer.meta.fileSize,
      });
    }
  }

  /**
   * Stream a single file to peer via 64KB self-describing WebSocket chunks with backpressure
   */
  async streamFile(jobId, fileIndex, file, specs, onProgress) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected to relay');
    }

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const transferKey = `${jobId}_${fileIndex}`;
    const keyBytes = new TextEncoder().encode(transferKey);
    const keyLen = keyBytes.length;

    // 1. Send file start envelope
    this.ws.send(
      JSON.stringify({
        type: 'file_start',
        jobId,
        fileIndex,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
        specs,
      })
    );

    // 2. Stream framed binary chunks
    let offset = 0;
    let chunkIndex = 0;

    while (offset < file.size) {
      // Respect backpressure
      while (this.ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          throw new Error('WebSocket disconnected during file streaming');
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const sliceBuffer = await slice.arrayBuffer();

      // Pack frame: [1 byte keyLen] [keyBytes] [raw slice bytes]
      const framed = new Uint8Array(1 + keyLen + sliceBuffer.byteLength);
      framed[0] = keyLen;
      framed.set(keyBytes, 1);
      framed.set(new Uint8Array(sliceBuffer), 1 + keyLen);

      this.ws.send(framed.buffer);

      offset += CHUNK_SIZE;
      chunkIndex++;

      const progress = Math.min(100, (offset / file.size) * 100);
      if (onProgress) {
        onProgress({
          jobId,
          fileIndex,
          fileName: file.name,
          chunkIndex,
          totalChunks,
          progress,
        });
      }
    }

    // 3. Send file end envelope
    this.ws.send(
      JSON.stringify({
        type: 'file_end',
        jobId,
        fileIndex,
      })
    );
  }

  /**
   * Notify peer of completed job submission
   */
  sendJobComplete(jobId, jobData) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'job_submitted',
          jobId,
          jobData,
        })
      );
    }
  }
}

// Export singleton instance for convenience
export const realtimeRelay = new RealtimeRelay();
