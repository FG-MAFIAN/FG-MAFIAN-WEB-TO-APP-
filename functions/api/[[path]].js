import { Writable } from 'node:stream';
import build from '../../api/build.js';
import status from '../../api/status.js';
import download from '../../api/download.js';
import health from '../../api/health.js';
import config from '../../api/config.js';
import admin from '../../api/admin.js';
import maintenance from '../../api/maintenance.js';

const handlers = { build, status, download, health, config, admin, maintenance };

class ResponseAdapter extends Writable {
  constructor() {
    super();
    this.code = 200;
    this.headers = new Headers();
    this.parts = [];
    this.headersSent = false;
    this.finished = false;
  }
  setHeader(name, value) { this.headers.set(name, String(value)); return this; }
  getHeader(name) { return this.headers.get(name); }
  status(code) { this.code = code; return this; }
  json(value) {
    this.headers.set('Content-Type', 'application/json; charset=utf-8');
    this.end(JSON.stringify(value));
    return this;
  }
  writeHead(code, headers = {}) {
    this.code = code;
    for (const [key, value] of Object.entries(headers)) this.headers.set(key, String(value));
    this.headersSent = true;
    return this;
  }
  _write(chunk, encoding, callback) {
    this.headersSent = true;
    this.parts.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
    callback();
  }
  end(chunk) {
    if (chunk !== undefined) this.parts.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
    this.finished = true;
    this.headersSent = true;
    super.end();
    return this;
  }
  toResponse() {
    return new Response(new Blob(this.parts), { status: this.code, headers: this.headers });
  }
}

async function dispatch(context) {
  const url = new URL(context.request.url);
  const name = url.pathname.split('/').filter(Boolean).at(-1);
  const handler = handlers[name];
  if (!handler) return Response.json({ error: 'API endpoint not found.' }, { status: 404 });
  const headers = Object.fromEntries(context.request.headers.entries());
  let body;
  if (!['GET', 'HEAD'].includes(context.request.method)) {
    const raw = await context.request.text();
    if (raw.length > 200_000) return Response.json({ error: 'Request body too large.' }, { status: 413 });
    if (raw) {
      try { body = JSON.parse(raw); }
      catch { body = raw; }
    }
  }
  const req = {
    method: context.request.method,
    headers,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    url: url.pathname + url.search
  };
  const res = new ResponseAdapter();
  try {
    await handler(req, res);
    return res.toResponse();
  } catch (error) {
    console.error('Cloudflare API adapter error:', error);
    return Response.json({ error: 'The API request failed.' }, { status: 500 });
  }
}
export const onRequest = dispatch;
                  
