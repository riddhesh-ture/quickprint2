/**
 * QuickPrint Real-Time Relay Worker + Durable Objects
 * Fast-lane WebSocket streaming for zero-cloud, direct P2P chunk transfer
 * Hardened with:
 * - CORS origin filtering
 * - Firebase ID Token validation for merchant role
 * - Single-active-merchant per room (closes older tabs to avoid duplicate transfers)
 */

let cachedJwks = null;
let cachedJwksExpiry = 0;

/**
 * Fetch Google's public JWKS for Firebase Auth token verification
 * Cached in memory for 1 hour
 */
async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedJwks && now < cachedJwksExpiry) {
    return cachedJwks;
  }
  try {
    const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    cachedJwks = data.keys || [];
    cachedJwksExpiry = now + 3600 * 1000;
    return cachedJwks;
  } catch (err) {
    console.error('Error fetching Google JWKS:', err);
    return cachedJwks || [];
  }
}

function base64UrlToUint8Array(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return JSON.parse(atob(base64));
}

/**
 * Validate merchant Firebase ID token claims and cryptographic RS256 signature
 * Ensures only the authenticated merchant with matching UID can connect as role=merchant
 */
async function verifyMerchantToken(token, shopId, env) {
  if (!token) {
    // In local dev without token, check if disabled via env
    if (env?.DISABLE_AUTH_VERIFY === 'true') {
      return { valid: true };
    }
    return { valid: false, reason: 'Missing authentication token for merchant role' };
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Malformed JWT format' };
    }

    const [headerPart, payloadPart, signaturePart] = parts;
    const header = decodeBase64UrlJson(headerPart);
    const payload = decodeBase64UrlJson(payloadPart);
    const nowSec = Math.floor(Date.now() / 1000);

    // 1. Expiration check with 60s clock skew
    if (payload.exp && (payload.exp + 60) < nowSec) {
      return { valid: false, reason: 'Merchant token has expired. Please refresh your session.' };
    }

    // 2. Subject check: must strictly match shopId (Firebase UID)
    if (payload.sub !== shopId) {
      return { valid: false, reason: 'Token identity does not match the requested shopId' };
    }

    // 3. Project audience check (if configured)
    if (env?.FIREBASE_PROJECT_ID && payload.aud !== env.FIREBASE_PROJECT_ID) {
      return { valid: false, reason: 'Token audience does not match Firebase project ID' };
    }

    // 4. Issuer check (must be securetoken.google.com/<projectId>)
    if (payload.iss && !payload.iss.startsWith('https://securetoken.google.com/')) {
      return { valid: false, reason: 'Invalid token issuer' };
    }

    // 5. Cryptographic RS256 signature verification
    if (env?.DISABLE_AUTH_VERIFY !== 'true') {
      const keys = await getGooglePublicKeys();
      const matchingKey = keys.find(k => k.kid === header.kid);
      if (!matchingKey) {
        return { valid: false, reason: `Unknown public key kid: ${header.kid}` };
      }

      const cryptoKey = await crypto.subtle.importKey(
        'jwk',
        matchingKey,
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' },
        },
        false,
        ['verify']
      );

      const dataToVerify = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
      const signatureBytes = base64UrlToUint8Array(signaturePart);

      const isValidSignature = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        signatureBytes,
        dataToVerify
      );

      if (!isValidSignature) {
        return { valid: false, reason: 'Invalid token cryptographic signature' };
      }
    }

    return { valid: true, payload };
  } catch (err) {
    return { valid: false, reason: `Token verification error: ${err.message}` };
  }
}

/**
 * Generate CORS headers with allowed origin validation
 */
function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configuredOrigins = env?.ALLOWED_ORIGINS 
    ? env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) 
    : null;

  // Automatically allow localhost and 127.0.0.1 for local development
  const isLocalDev = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
  const isAllowed = !configuredOrigins || configuredOrigins.includes(origin) || isLocalDev || origin === '';

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : (configuredOrigins?.[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export class PrintRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> { role: 'merchant' | 'customer', authenticated: boolean, joinedAt: number }
  }

  isMerchantOnline() {
    for (const [ws, data] of this.sessions.entries()) {
      if (data.role === 'merchant' && data.authenticated !== false && (ws.readyState === WebSocket.OPEN || ws.readyState === 1)) {
        return true;
      }
    }
    return false;
  }

  broadcastPresence() {
    const merchantOnline = this.isMerchantOnline();
    const msg = JSON.stringify({
      type: 'merchant_presence',
      presence: merchantOnline,
      online: merchantOnline,
      timestamp: Date.now(),
    });

    for (const [ws] of this.sessions.entries()) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === 1) {
        try {
          ws.send(msg);
        } catch (err) {
          console.error('Error broadcasting presence:', err);
        }
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role') || 'customer'; // 'merchant' | 'customer'
    const shopId = url.searchParams.get('shopId') || url.searchParams.get('merchantId');
    const corsHeaders = getCorsHeaders(request, this.env);

    // If HTTP GET and not upgrading to WebSocket, return room status info
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(
        JSON.stringify({
          status: 'ready',
          merchantOnline: this.isMerchantOnline(),
          connectedClients: this.sessions.size,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Upgrade to WebSocket
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Check if token was provided in upgrade request headers or query params
    let token = url.searchParams.get('token') || url.searchParams.get('auth');
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    let preAuthenticated = false;
    if (role === 'merchant' && token) {
      const authCheck = await verifyMerchantToken(token, shopId, this.env);
      if (authCheck.valid) {
        preAuthenticated = true;
      }
    }

    this.handleSession(server, role, preAuthenticated, shopId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  handleSession(ws, role, preAuthenticated = false, shopId = null) {
    // In Cloudflare Workers DO, server websocket must be accepted
    ws.accept();

    const isMerchant = role === 'merchant';
    const initialAuthenticated = !isMerchant || preAuthenticated;

    let authTimeout = null;

    const closeExistingMerchants = () => {
      for (const [peer, peerData] of this.sessions.entries()) {
        if (peer !== ws && peerData.role === 'merchant') {
          try {
            peer.send(
              JSON.stringify({
                type: 'session_replaced',
                message: 'A newer dashboard tab connected. This session has been closed.',
              })
            );
            peer.close(4001, 'Session replaced by newer tab');
          } catch (e) {
            console.error('Error closing superseded merchant tab:', e);
          }
          this.sessions.delete(peer);
        }
      }
    };

    if (isMerchant && preAuthenticated) {
      closeExistingMerchants();
    } else if (isMerchant && !preAuthenticated) {
      // Allow 5 seconds for client to send { type: 'auth', token } envelope
      authTimeout = setTimeout(() => {
        const session = this.sessions.get(ws);
        if (session && !session.authenticated) {
          try {
            ws.send(JSON.stringify({ type: 'auth_error', reason: 'Authentication timeout (5s)' }));
            ws.close(4408, 'Authentication timeout');
          } catch {
            // ignore
          }
          this.sessions.delete(ws);
          this.broadcastPresence();
        }
      }, 5000);
    }

    this.sessions.set(ws, { role, authenticated: initialAuthenticated, joinedAt: Date.now() });

    // Send immediate presence response to the newly connected client
    try {
      ws.send(
        JSON.stringify({
          type: 'merchant_presence',
          presence: this.isMerchantOnline(),
          online: this.isMerchantOnline(),
          role,
          connected: true,
        })
      );
    } catch (e) {
      console.error('Failed to send initial presence:', e);
    }

    // Broadcast presence update to everyone in the room if merchant status changed
    if (initialAuthenticated) {
      this.broadcastPresence();
    }

    ws.addEventListener('message', async (event) => {
      try {
        const currentSession = this.sessions.get(ws);

        // Handle text JSON control envelopes
        if (typeof event.data === 'string') {
          try {
            const parsed = JSON.parse(event.data);

            if (parsed.type === 'ping') {
              ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
              return;
            }

            // Post-connection merchant authentication envelope (Fixes Issue 2.3)
            if (parsed.type === 'auth') {
              if (currentSession && currentSession.role === 'merchant') {
                if (authTimeout) {
                  clearTimeout(authTimeout);
                  authTimeout = null;
                }
                const authCheck = await verifyMerchantToken(parsed.token, shopId, this.env);
                if (authCheck.valid) {
                  currentSession.authenticated = true;
                  closeExistingMerchants();
                  try {
                    ws.send(JSON.stringify({ type: 'auth_success' }));
                  } catch {
                    // ignore
                  }
                  this.broadcastPresence();
                } else {
                  try {
                    ws.send(JSON.stringify({ type: 'auth_error', reason: authCheck.reason }));
                    ws.close(4401, 'Unauthorized');
                  } catch {
                    // ignore
                  }
                  this.sessions.delete(ws);
                  this.broadcastPresence();
                }
                return;
              }
            }
          } catch {
            // Not a JSON control message, continue to message forwarding
          }
        }

        // Drop messages from unauthenticated merchant sessions
        if (currentSession?.role === 'merchant' && !currentSession.authenticated) {
          return;
        }

        // Forward data securely: Customers send ONLY to authenticated merchant, Merchant sends to customers
        const senderRole = currentSession?.role || 'customer';

        for (const [peer, peerData] of this.sessions.entries()) {
          if (peer === ws || (peer.readyState !== WebSocket.OPEN && peer.readyState !== 1)) continue;

          // Customer data (binary file chunks, job envelopes) MUST ONLY go to authenticated merchant
          if (senderRole === 'customer') {
            if (peerData.role === 'merchant' && peerData.authenticated) {
              peer.send(event.data);
            }
          } else if (senderRole === 'merchant') {
            // Merchant broadcasts (e.g. status) go to customers
            peer.send(event.data);
          }
        }
      } catch (err) {
        console.error('Error forwarding message in PrintRoom:', err);
      }
    });

    const cleanup = () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
        authTimeout = null;
      }
      this.sessions.delete(ws);
      this.broadcastPresence();
    };

    ws.addEventListener('close', cleanup);
    ws.addEventListener('error', cleanup);
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check route
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          service: 'quickprint-relay',
          status: 'online',
          version: '2.1.0',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Route /room?shopId=... or /room?merchantId=...
    if (url.pathname === '/room' || url.pathname === '/ws') {
      const shopId = url.searchParams.get('shopId') || url.searchParams.get('merchantId');
      if (!shopId) {
        return new Response(
          JSON.stringify({ error: 'Missing required query parameter: shopId or merchantId' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      if (!env.PRINT_ROOM) {
        return new Response(
          JSON.stringify({ error: 'PRINT_ROOM Durable Object binding not configured' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const role = url.searchParams.get('role') || 'customer';
      let token = url.searchParams.get('token') || url.searchParams.get('auth');
      if (!token) {
        const authHeader = request.headers.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      // If token is provided at initial connection time for merchant role, verify it immediately.
      // If omitted from URL (for security), PrintRoom requires post-connection { type: 'auth', token } envelope.
      if (role === 'merchant' && token) {
        const authCheck = await verifyMerchantToken(token, shopId, env);
        if (!authCheck.valid) {
          return new Response(
            JSON.stringify({ error: `Unauthorized merchant: ${authCheck.reason}` }),
            {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // Route to Durable Object unique to this shop/merchant
      const id = env.PRINT_ROOM.idFromName(shopId);
      const roomObject = env.PRINT_ROOM.get(id);

      return roomObject.fetch(request);
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
