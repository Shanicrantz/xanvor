/* /img/:name — serves admin-uploaded product photos from Netlify Blobs */
import { getStore } from '@netlify/blobs';

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export default async (req) => {
  const name = decodeURIComponent(new URL(req.url).pathname.replace(/^\/img\//, ''));
  if (!/^[\w][\w.-]{0,80}$/.test(name)) return new Response('Bad name', { status: 400 });
  const ext = name.split('.').pop().toLowerCase();
  const type = TYPES[ext];
  if (!type) return new Response('Unsupported type', { status: 400 });

  const store = getStore('xanvor-images');
  const buf = await store.get(name, { type: 'arrayBuffer' });
  if (!buf) return new Response('Not found', { status: 404 });

  return new Response(buf, {
    headers: {
      'content-type': type,
      /* filenames are timestamped-unique, safe to cache forever */
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config = { path: '/img/:name' };
