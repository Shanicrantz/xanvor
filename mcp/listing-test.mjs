/* Test all listing renderers against a real ref image → upload to a temp
   draft product → print /img URLs → cleanup. Run:
     XANVOR_ADMIN_KEY=... node listing-test.mjs "<ref.jpg>" */
import { whiteMain, renderCallouts, renderCollage, renderHero } from './listing.mjs';
import { writeFile } from 'node:fs/promises';

const SITE = 'https://xanvor.com';
const KEY = process.env.XANVOR_ADMIN_KEY;
const REF = process.argv[2];
const ID = 'zz-listing-test';
const HIGHLIGHTS = ['Green stone cabochons', 'Gallery tray format', 'Hand-set in Moradabad', 'Heavy-gauge brass', 'Gift-ready packaging'];

async function admin(p) {
  const r = await fetch(`${SITE}/api/admin`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY }, body: JSON.stringify(p) });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || r.status); return d;
}
const up = async (name, buf) => (await admin({ action: 'upload-image', name, dataBase64: buf.toString('base64') })).path;

console.log('1. whiteMain…');
const main = await whiteMain(REF);
console.log('   prod rect:', main.prod, '| AI:', main.usedAI, '|', Math.round(main.buf.length / 1024) + 'KB');
await writeFile('/tmp/lt-main.jpg', main.buf);

console.log('2. callouts (auto-placed from highlights)…');
const co = await renderCallouts(main.buf, main.prod, HIGHLIGHTS.map(t => ({ text: t })));
await writeFile('/tmp/lt-callouts.jpg', co);
console.log('   ', Math.round(co.length / 1024) + 'KB');

console.log('3. collage (2 copies)…');
const col = await renderCollage([main.buf, main.buf], 'Zamarrud Gemstone Brass Tray');
await writeFile('/tmp/lt-collage.jpg', col);
console.log('   ', Math.round(col.length / 1024) + 'KB');

console.log('4. hero…');
const hero = await renderHero(main.buf, 'Zamarrud Gemstone Brass Tray', HIGHLIGHTS);
await writeFile('/tmp/lt-hero.jpg', hero);
console.log('   ', Math.round(hero.length / 1024) + 'KB');

console.log('5. upload all + attach to temp draft…');
await admin({ action: 'save', product: { id: ID, name: 'Listing Test', collection: 'The Jewel Collection', desc: 't', status: 'draft' } });
const paths = [];
paths.push(await up(ID + '-main.jpg', main.buf));
paths.push(await up(ID + '-callouts.jpg', co));
paths.push(await up(ID + '-collage.jpg', col));
paths.push(await up(ID + '-hero.jpg', hero));
await admin({ action: 'save', product: { id: ID, name: 'Listing Test', collection: 'The Jewel Collection', desc: 't', status: 'draft', images: paths, image: paths[0] } });
console.log('   uploaded:', paths.map(p => SITE + p));

console.log('\nLocal previews: /tmp/lt-main.jpg /tmp/lt-callouts.jpg /tmp/lt-collage.jpg /tmp/lt-hero.jpg');
console.log('Cleanup: keeping temp product zz-listing-test for review (delete via delete_product when done).');
