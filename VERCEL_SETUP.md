# Configuração no Vercel

## Segurança: Separação de Domínios

Este projeto usa middleware para separar o acesso entre:
- **Painel do Comprador**: `app.cota.i`
- **Portal dos Fornecedores**: `fornecedor.cota.i`

## Passo a Passo

### 1. Deploy no Vercel

```bash
# Instalar Vercel CLI (se ainda não tiver)
npm i -g vercel

# Fazer login
vercel login

# Deploy
vercel
```

### 2. Configurar Domínios Customizados

No painel do Vercel:

1. Vá em **Settings** > **Domains**
2. Adicione os domínios:
   - `app.cota.i` (ou `app.seudominio.com`)
   - `fornecedor.cota.i` (ou `fornecedor.seudominio.com`)

### 3. Configurar DNS

No seu provedor de DNS (ex: GoDaddy, Cloudflare, etc):

**Para `app.cota.i`:**
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

**Para `fornecedor.cota.i`:**
```
Type: CNAME
Name: fornecedor
Value: cname.vercel-dns.com
```

### 4. Configurar Variáveis de Ambiente

No Vercel, vá em **Settings** > **Environment Variables** e adicione:

```
NEXT_PUBLIC_FIREBASE_API_KEY=sua_chave
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu_dominio.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu_projeto_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=seu_app_id

FIREBASE_PROJECT_ID=seu_projeto_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
```

### 5. Atualizar Firebase OAuth

No Firebase Console:
1. Vá em **Authentication** > **Settings** > **Authorized domains**
2. Adicione:
   - `app.cota.i`
   - `fornecedor.cota.i`

## Como Funciona

### Middleware de Segurança

O arquivo `src/middleware.ts` intercepta todas as requisições e:

#### No subdomínio `app.cota.i`:
- ✅ Permite acesso a: `/compras`, `/insumos`, `/fornecedores`, `/cotacao`, etc.
- ❌ **BLOQUEIA** acesso a: `/portal/*` → Redireciona para `/compras`

#### No subdomínio `fornecedor.cota.i`:
- ✅ Permite acesso a: `/portal/{supplierId}`
- ❌ **BLOQUEIA** acesso a: `/compras`, `/insumos`, etc. → Redireciona para `/portal`

### Desenvolvimento Local

Em desenvolvimento (`localhost` ou `nip.io`), o middleware **permite tudo** para facilitar o desenvolvimento.

## Estrutura de URLs

### Produção:

**Comprador:**
```
https://app.cota.i/compras
https://app.cota.i/cotacao
https://app.cota.i/fornecedores
```

**Fornecedor:**
```
https://fornecedor.cota.i/portal/za1F8jg4jgi5PgCnuhCv
```

Se um fornecedor tentar acessar:
```
https://fornecedor.cota.i/compras  → Redireciona para /portal
```

Se um comprador tentar acessar:
```
https://app.cota.i/portal/xyz  → Redireciona para /compras
```

## Segurança

✅ **Problema resolvido**: Fornecedores não podem mais acessar o painel do comprador
✅ **Isolamento completo**: Cada subdomínio tem acesso apenas às suas rotas
✅ **Desenvolvimento facilitado**: Em localhost funciona normalmente para testes

## Custos

- **Vercel Free Tier**: Suporta domínios customizados gratuitamente
- **DNS**: Dependendo do provedor (muitos são gratuitos)
- **Firebase**: Continue usando o plano atual

## Suporte

Se tiver problemas:
1. Verifique os logs do Vercel
2. Confirme que os domínios estão apontando corretamente
3. Aguarde até 48h para propagação do DNS
