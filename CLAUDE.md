# Wellness Fit Store — contexto do projeto

Catálogo online da **Wellness Fit Store** (moda fitness feminina — Instagram `@_wellnessfitstore_`, WhatsApp (62) 9 9915-9551). Cliente do Brayam. A cliente vê as peças com foto e preço e chama no WhatsApp; não há carrinho nem pagamento. Painel `admin.html` pra lojista cadastrar peças, fotos, promoção e destaque.

## Onde está cada coisa (produção)

| O quê | Onde | Conta |
|---|---|---|
| Site | https://wellness-fit-store.vercel.app (admin em `/admin.html`) | — |
| Hospedagem | Vercel, projeto `brayam-s-projects/wellness-fit-store` | Vercel `brayam777` |
| Código | GitHub `brayam777/wellness-fit-store` — push na `main` publica sozinho | GitHub `brayam777` |
| Banco + login | Supabase ref **`vxeokiiwdsbwodlriadm`** (us-west-2; nome no painel: "barayamgamer@gmail.com's Project") | Supabase **barayamgamer@gmail.com** |
| Fotos | S3 (MinIO) `https://s3.inovai.dev.br`, bucket `catalogo-brayam`, prefixo `wellness-fit-store/` | chaves só nas env vars da Vercel (`S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET`) |

**NÃO usar:**
- Outros projetos Supabase: a conta barayamgamer (e a outra conta do Brayam) têm projetos de **outros clientes** com nomes parecidos. O deste site é **só** o `vxeokiiwdsbwodlriadm` — confira o ref antes de qualquer `link`, `db push` ou SQL.
- Bucket Supabase Storage `wellness-photos` (deste mesmo projeto): **legado**, as fotos foram migradas pra S3. Só as 3 fotos do hero ainda apontam pra lá (ver pendências).
- Projeto Firebase `wellness-fit-store`: tentativa abandonada (Storage exigia cartão). Não usar.
- O bucket `catalogo-brayam` é compartilhado com outros sites — só mexa no prefixo `wellness-fit-store/`.

## Stack e convenções

- Site estático: HTML + CSS + JS puro (ES modules), **sem build**. `supabase-js` vem do esm.sh **fixado em `@2.111.0`** (`js/supabase-config.js`) — a versão `@2` solta quebrou o site inteiro uma vez (build ruim do postgrest-js no esm.sh). Só suba a versão testando.
- Uma função serverless da Vercel: `api/presign-upload.js` (Node, CommonJS, AWS SDK v3). Valida a sessão do admin no Supabase e devolve uma URL assinada de upload pra S3. A chave secreta da S3 nunca vai pro navegador.
- Português nos textos e comentários; comentário só quando o "porquê" não é óbvio.
- Links de WhatsApp abrem **na mesma aba** (sem `target="_blank"`) — mais confiável pra abrir o app no celular.
- Mobile: grid do catálogo em 2 colunas abaixo de 640px; inputs com `font-size` ≥ 16px (evita zoom do iOS).

## Regras de negócio (e onde mudar junto)

- **Nome da peça em Iniciais Maiúsculas** — 3 lugares precisam bater: `titleCase()` em `js/admin.js` (ao salvar), `titleCase()` em `js/main.js` (ao exibir) e a migração `20260807000000_titlecase_names.sql` (usou `initcap()` no banco).
- **Promoção ("de / por")**: no admin, **Preço** = o que a cliente paga; **Preço original** = o valor riscado, maior. Só aparece desconto se `original_price > price` (`hasPromo()` em `js/main.js`; % em `discountPercent()`). A lojista já inverteu os dois campos uma vez — se "a promoção não aparece", confira isso primeiro.
- **Só uma peça em destaque** (banner no topo): garantido **só no front** (`handleSubmitProduct` em `js/admin.js` desmarca as outras depois de salvar). Não há constraint no banco; `tests/smoke.mjs` confere.
- **Quem pode editar**: login é por **senha única** (sem e-mail na tela) numa conta fixa `brayamfelipe02@gmail.com`. Esse e-mail aparece em 3 lugares que precisam bater: `SHARED_LOGIN_EMAIL` em `js/admin.js`, `ADMIN_EMAIL` em `api/presign-upload.js`, e a tabela `wellness_admins` (RLS via `is_wellness_admin()`). A senha **não está no repositório** — fica com o Brayam / Supabase Auth.
- **URL e chave pública do Supabase** estão em `js/supabase-config.js`, `api/presign-upload.js` e `tests/smoke.mjs` (é a chave *publishable*, pode ficar no código).
- **WhatsApp/Instagram**: constantes `WHATSAPP_NUMBER` e `INSTAGRAM_HANDLE` em `js/main.js`; o número também está escrito no botão de contato em `index.html`.
- **Fotos**: tabela `wellness_products.media` (jsonb `[{url, type:'image'}]`), várias por peça (carrossel). O admin comprime no navegador (máx. 1440px, JPEG 0.85 — `compressImage()`), pede URL assinada e faz PUT direto na S3.
- **Catálogo de exemplo**: `SEED_PRODUCTS` em `js/admin.js` e o insert em `20260803120000_init.sql` são a mesma lista — se mudar um, mude o outro.

## Banco de dados

Tabelas: `wellness_products` (name, category, price, original_price, featured, media, created_at) e `wellness_admins` (email). RLS: leitura pública dos produtos; escrita só admin.

**Migrações NÃO vão com o push.** O push só publica o site. Mudança de banco:
1. Crie um arquivo novo em `supabase/migrations/` (`AAAAMMDDHHMMSS_descricao.sql`), idempotente quando der (`if not exists`, `drop policy if exists`).
2. Aplique de um destes jeitos:
   - **SQL Editor** do painel Supabase (conta barayamgamer): cole e rode. Foi assim que as 4 migrações atuais foram aplicadas.
   - **CLI**: `npx supabase login` com a conta **barayamgamer@gmail.com**, `npx supabase link --project-ref vxeokiiwdsbwodlriadm` e `npx supabase db push`. ⚠️ Antes do primeiro `db push`, rode `npx supabase migration list`: o histórico remoto provavelmente está vazio (tudo foi aplicado à mão), e o `db push` tentaria rodar tudo de novo — a `20260806000000_multi_photos.sql` **falha** se rodar outra vez (a coluna `image_url` já não existe). Marque as 4 como aplicadas: `npx supabase migration repair --status applied 20260803120000 20260803130000 20260806000000 20260807000000`.
   - O `supabase login` é global: trocar pra barayamgamer tira o acesso das outras contas (MecanicSafe/Luanne usam brayamfelipe02).

## Rodar local

- `npm run serve` → http://localhost:8082 (servidor estático simples `serve.cjs`; **não** roda `/api`, então upload de foto no admin não funciona assim).
- Pra testar o admin com upload: `npx vercel link` (projeto `wellness-fit-store`), `npx vercel env pull .env.local` e `npx vercel dev`.
- Atenção: local ou não, o site usa o **banco de produção** (não há banco de teste). Cuidado ao cadastrar/apagar peças.

## Testes

- `npm test` — smoke test do site publicado (home, admin, API recusa sem login, arquivos internos dão 404, catálogo e fotos na S3). Sem dependências. Outro endereço: `BASE_URL=http://localhost:3000 npm test`.
- `npm run test:s3` — confere a S3 (credenciais, política só-leitura, escrita anônima bloqueada). Precisa de `npm install` e do `.env.local` (`npx vercel env pull .env.local`).

## Deploy

Push na `main` do GitHub → a Vercel publica em produção sozinha. O `.vercelignore` impede que `tests/`, `supabase/`, `CLAUDE.md`, `README.md`, `serve.cjs` e `.claude/` vão pro site.

## Pendências

- As 3 fotos do hero (`index.html`) ainda apontam pro Supabase Storage (`wellness-photos`) — mover pra S3 e apagar o bucket antigo pra zerar o uso de banda do Supabase.
- Uploads novos na S3 não definem `Cache-Control` (`api/presign-upload.js`); um cache longo (as chaves são UUID, nunca sobrescritas) economizaria banda.
- Fotos são servidas no tamanho cheio (até 1440px) até nos cards; uma miniatura (como o Luanne Pratas fez, `-thumb.jpg`) deixaria o celular mais rápido.
- Sem banco de teste: tudo roda contra produção.
