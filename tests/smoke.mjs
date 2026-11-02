// Smoke test do site publicado (sem dependências — só Node 18+).
// Uso: npm test            (testa produção)
//      BASE_URL=http://localhost:3000 npm test   (testa outro endereço, ex.: `vercel dev`)

const BASE_URL = (process.env.BASE_URL || 'https://wellness-fit-store.vercel.app').replace(/\/$/, '');

// Mesma URL/chave pública de js/supabase-config.js (não é segredo).
const SUPABASE_URL = 'https://vxeokiiwdsbwodlriadm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_SW-vmqabZBpebIXjgQSjQQ__xCNmggO';

// Arquivos internos que NUNCA podem ser servidos pelo site (ver .vercelignore).
const MUST_BE_PRIVATE = [
  '/CLAUDE.md',
  '/README.md',
  '/serve.cjs',
  '/tests/smoke.mjs',
  '/supabase/migrations/20260803120000_init.sql',
  '/.vercel/project.json',
  '/.claude/launch.json',
];

let failures = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name} — ${err.message}`);
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

await check('home responde 200 e tem a marca', async () => {
  const r = await fetch(`${BASE_URL}/`);
  expect(r.status === 200, `status ${r.status}`);
  expect((await r.text()).includes('WELLNESS FIT'), 'texto "WELLNESS FIT" não encontrado');
});

await check('painel admin responde 200', async () => {
  const r = await fetch(`${BASE_URL}/admin.html`);
  expect(r.status === 200, `status ${r.status}`);
});

await check('upload sem login é recusado (401)', async () => {
  const r = await fetch(`${BASE_URL}/api/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ext: 'jpg', contentType: 'image/jpeg' }),
  });
  expect(r.status === 401, `status ${r.status} (esperado 401)`);
});

await check('upload com token falso é recusado (401)', async () => {
  const r = await fetch(`${BASE_URL}/api/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-falso' },
    body: JSON.stringify({ ext: 'jpg', contentType: 'image/jpeg' }),
  });
  expect(r.status === 401, `status ${r.status} (esperado 401)`);
});

for (const path of MUST_BE_PRIVATE) {
  await check(`arquivo interno não é público: ${path}`, async () => {
    const r = await fetch(`${BASE_URL}${path}`);
    expect(r.status === 404, `status ${r.status} (esperado 404)`);
  });
}

await check('catálogo carrega do Supabase e as fotos estão na S3', async () => {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wellness_products?select=name,price,original_price,featured,media`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  expect(r.status === 200, `status ${r.status}`);
  const products = await r.json();
  expect(products.length > 0, 'nenhum produto cadastrado');
  const featured = products.filter((p) => p.featured);
  expect(featured.length <= 1, `${featured.length} peças em destaque (o máximo é 1)`);
  const notOnS3 = products.flatMap((p) => p.media || []).filter((m) => !m.url.includes('s3.inovai.dev.br'));
  expect(notOnS3.length === 0, `${notOnS3.length} foto(s) ainda fora da S3`);
});

console.log(failures ? `\n${failures} falha(s).` : '\nTudo certo.');
process.exit(failures ? 1 : 0);
