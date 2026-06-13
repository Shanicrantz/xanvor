/* ============================================================
   XANVOR remote MCP — claude.ai custom connector endpoint.

   Hand-rolled MCP over Streamable HTTP (stateless JSON-RPC).
   URL (add as a custom connector in claude.ai):
     https://xanvor.com/mcp/<XANVOR_MCP_TOKEN>

   The path token is the only gate (claude.ai authless connector) —
   so the URL is a secret. Server-side it calls /api/admin with the
   real XANVOR_ADMIN_KEY (never exposed to claude.ai).

   Tools: list_products, get_product, upsert_product,
          set_product_status, delete_product
   (Photo upload/AI optimization stays in admin Photo Studio /
    Claude Code — claude.ai can't pass image files to MCP tools.)
   ============================================================ */

const SITE = 'https://xanvor.com';
const PROTOCOL = '2025-06-18';
const COLLECTIONS = ['Silver & Gold', 'Copper', 'Brass', 'Sheesham & Wood', 'Wireform Furniture', 'Hot-Serve', 'Artisanal Serving Trays', 'Copper Home Collection', 'The Jewel Collection', 'Canister & Vanity Series', 'Ribbed Storage Collection'];

async function admin(payload) {
  const key = process.env.XANVOR_ADMIN_KEY;
  if (!key) throw new Error('Server XANVOR_ADMIN_KEY missing');
  const r = await fetch(`${SITE}/api/admin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': key },
    body: JSON.stringify(payload),
  });
  const d = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error(d.error || `admin HTTP ${r.status}`);
  return d;
}

const brief = (p) => ({
  id: p.id, name: p.name, collection: p.collection, status: p.status || 'live',
  retail_incl_gst: p.retail ? Math.round(p.retail * (1 + (parseFloat(p.gst) || 18) / 100)) : null,
  mrp: p.mrp || null, photos: (p.images || (p.image ? [p.image] : [])).length,
});

/* ---- tool definitions (JSON Schema) ---- */
const COLLECTION_SCHEMA = { type: 'string', enum: COLLECTIONS };
const TOOLS = [
  {
    name: 'list_products',
    description: 'XANVOR catalogue ke products list karo (live + draft dono). Filters optional.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: COLLECTION_SCHEMA,
        status: { type: 'string', enum: ['live', 'draft'] },
        q: { type: 'string', description: 'naam/id me search' },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Ek product ka poora record (saare fields + photo gallery).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'upsert_product',
    description: 'Product banao ya update karo. Naya DRAFT me banao (status: draft). Sirf bheje fields update hote hain; id zaroori. retail ex-GST hota hai (customer retail×(1+GST) deta hai); MRP tax-inclusive. Photos alag se admin Photo Studio / Claude Code se lagti hain.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'jaise tr-107 (lowercase, dash)' },
        name: { type: 'string' },
        collection: COLLECTION_SCHEMA,
        series: { type: 'string' },
        materials: { type: 'string', description: '· se alag, jaise "Solid Brass · Hand-Hammered"' },
        desc: { type: 'string' },
        construction: { type: 'string' },
        sizes: { type: 'string' },
        moq: { type: 'string' },
        hsn: { type: 'string' },
        gst: { type: 'string', enum: ['18%', '12%', '5%'] },
        tag: { type: 'string' },
        signature: { type: 'boolean' },
        mrp: { type: 'number' },
        retail: { type: 'number', description: 'B2C price ex-GST' },
        offer: { type: 'number', description: 'B2B/trade price ex-works' },
        highlights: { type: 'array', items: { type: 'string' }, maxItems: 8 },
        availability: { type: 'string', enum: ['in_stock', 'out_of_stock'] },
        status: { type: 'string', enum: ['live', 'draft'] },
      },
      required: ['id'],
    },
  },
  {
    name: 'set_product_status',
    description: 'Product ko live karo ya draft me chhupao.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, status: { type: 'string', enum: ['live', 'draft'] } }, required: ['id', 'status'] },
  },
  {
    name: 'delete_product',
    description: 'Product PERMANENTLY hatao (website, sitemap, Google feed sab se). Pehle user se confirm karo.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
];

async function getProduct(id) {
  const { products } = await admin({ action: 'list' });
  const p = products.find(x => x.id === id);
  if (!p) throw new Error(`Product "${id}" catalogue me nahi mila`);
  return p;
}

async function callTool(name, args = {}) {
  if (name === 'list_products') {
    const { products, updated_at } = await admin({ action: 'list' });
    let items = products;
    if (args.collection) items = items.filter(p => p.collection === args.collection);
    if (args.status) items = items.filter(p => (p.status || 'live') === args.status);
    if (args.q) { const s = String(args.q).toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(s) || p.id.includes(s)); }
    return { total: items.length, updated_at, products: items.map(brief) };
  }
  if (name === 'get_product') return await getProduct(args.id);
  if (name === 'upsert_product') {
    const { products } = await admin({ action: 'list' });
    const existing = products.find(p => p.id === args.id);
    const merged = { ...(existing || {}), ...args };
    if (args.availability === 'in_stock') delete merged.availability;
    if (args.status === 'live') delete merged.status;
    const out = await admin({ action: 'save', product: merged });
    return { saved: true, was_existing: !!existing, product: brief(out.product), note: out.product.status === 'draft' ? 'DRAFT — live karne tak website pe nahi' : 'LIVE — website/Google pe ~1-5 min me' };
  }
  if (name === 'set_product_status') {
    const p = await getProduct(args.id);
    const merged = { ...p };
    if (args.status === 'draft') merged.status = 'draft'; else delete merged.status;
    await admin({ action: 'save', product: merged });
    return { id: args.id, status: args.status };
  }
  if (name === 'delete_product') {
    const out = await admin({ action: 'delete', id: args.id });
    return { deleted: args.id, remaining: out.count };
  }
  throw new Error(`unknown tool: ${name}`);
}

/* ---- JSON-RPC handling ---- */
const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

async function handleMessage(msg) {
  const { id, method, params } = msg || {};
  // notifications (no id) → no response
  if (id === undefined || id === null) return null;
  try {
    if (method === 'initialize') {
      return rpcResult(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'xanvor-catalog', version: '1.0.0' },
        instructions: 'XANVOR product catalogue. Photos admin Photo Studio / Claude Code se lagti hain.',
      });
    }
    if (method === 'tools/list') return rpcResult(id, { tools: TOOLS });
    if (method === 'ping') return rpcResult(id, {});
    if (method === 'tools/call') {
      const out = await callTool(params?.name, params?.arguments || {});
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(out, null, 1) }] });
    }
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (e) {
    // tool errors → return as tool result with isError so the model sees the message
    if (method === 'tools/call') {
      return rpcResult(id, { content: [{ type: 'text', text: 'Error: ' + (e.message || 'failed') }], isError: true });
    }
    return rpcError(id, -32603, e.message || 'internal error');
  }
}

const J = (obj, status = 200) => new Response(obj === null ? '' : JSON.stringify(obj), {
  status: obj === null ? 202 : status,
  headers: {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'POST, GET, OPTIONS',
    'cache-control': 'no-store',
  },
});

export default async (req, context) => {
  const token = (context && context.params && context.params.token) ||
    new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const expected = process.env.XANVOR_MCP_TOKEN;

  if (req.method === 'OPTIONS') return J(null);
  if (!expected || token !== expected) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  // No server-initiated SSE stream in stateless mode.
  if (req.method === 'GET') return new Response('Method Not Allowed', { status: 405 });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return J(rpcError(null, -32700, 'Parse error'), 400); }

  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handleMessage))).filter(Boolean);
    return J(out.length ? out : null);
  }
  return J(await handleMessage(body));
};

export const config = { path: '/mcp/:token' };
