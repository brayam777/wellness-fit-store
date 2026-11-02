# Wellness Fit Store

Catálogo online de moda fitness feminina com pedido pelo WhatsApp.

- Site: https://wellness-fit-store.vercel.app
- Painel da lojista: https://wellness-fit-store.vercel.app/admin.html (senha única, não fica no repositório)

HTML/CSS/JS puro, banco e login no Supabase, fotos numa S3 própria, hospedado na Vercel. Detalhes técnicos, contas e regras de negócio estão em [CLAUDE.md](CLAUDE.md).

## Rodar local

```bash
npm run serve
```

Abre em http://localhost:8082. Esse servidor simples não roda a função `/api` (upload de fotos); pra testar o painel completo use `npx vercel dev` (ver abaixo). O site local usa o banco de **produção**.

## Testes

```bash
npm test
```

Smoke test do site publicado. Pra conferir também a S3: `npm install`, `npx vercel env pull .env.local` e `npm run test:s3`.

## Publicar

Commit + `git push` na branch `main` → a Vercel publica sozinha em alguns segundos.

Mudanças no **banco** não vão com o push: crie um `.sql` em `supabase/migrations/` e aplique no SQL Editor do Supabase (conta barayamgamer@gmail.com) ou pela CLI — passo a passo em [CLAUDE.md](CLAUDE.md#banco-de-dados).

## Continuar em outro computador

**Instalar:** [Git](https://git-scm.com/downloads), [Node.js LTS](https://nodejs.org) (vem com `npm`/`npx`) e o [GitHub CLI](https://cli.github.com).

**Comandos:**

```bash
gh auth login --web
gh repo clone brayam777/wellness-fit-store
cd wellness-fit-store
npm install
npm test
```

**Só se for testar o painel com upload ou rodar `npm run test:s3`:**

```bash
npx vercel login
npx vercel link --yes --project wellness-fit-store --scope brayam-s-projects
npx vercel env pull .env.local
npx vercel dev
```

**Só se for mexer no banco pela CLI** (o SQL Editor do painel do Supabase também serve):

```bash
npx supabase login
npx supabase link --project-ref vxeokiiwdsbwodlriadm
npx supabase migration list
```

Entre com a conta **barayamgamer@gmail.com** no Supabase. Leia a seção de banco do [CLAUDE.md](CLAUDE.md#banco-de-dados) antes do primeiro `db push`.

**Publicar:** `git add`, `git commit` e `git push` — a Vercel faz o resto.
