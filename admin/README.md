# Painel de Administração (local)

Tela **só para você**, roda na sua máquina. Serve para gerenciar **várias paróquias**
sem precisar abrir o painel do Supabase.

## ⚠️ Segurança

- Usa a **service_role key** do Supabase, que **ignora o RLS** (acesso total ao banco).
- Nunca é publicado: o deploy (`.github/workflows/deploy.yml`) só envia `dist/`, a pasta `admin/` fica de fora.
- `admin/.env.local` está no `.gitignore` — a chave nunca vai para o Git.
- Não rode isso numa rede pública nem deixe a porta exposta.

## Configurar (uma vez)

1. Copie o exemplo:
   ```
   cp admin/.env.local.example admin/.env.local
   ```
2. Pegue a chave em **Supabase → Project Settings → API → `service_role` (secret)** e cole em `admin/.env.local`.

## Usar

```
npm run admin
```

Abre em <http://localhost:8787>. Funções:

| Seção | O que faz |
|---|---|
| **Paróquias** | Lista todas, com contagem de servidores/comunidades; ativar/desativar |
| **Nova paróquia** | Cadastra nome, cidade, diocese |
| **Novo coordenador** | Cria o login (e-mail + senha), confirma o e-mail e vincula o `coordenador_profiles` à paróquia |
| **Resetar senha** | Define nova senha para qualquer usuário pelo e-mail |
| **Ver dados de uma paróquia** | Coordenadores, servidores, comunidades, saldo do livro caixa, contagem de formação/atas |

Requer **Node 20+** (usa `--env-file`). Nenhuma dependência além do `@supabase/supabase-js` que o projeto já tem.
