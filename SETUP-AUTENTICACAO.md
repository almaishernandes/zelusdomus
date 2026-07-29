# ZelusDomus — Setup de Autenticação e Permissões

Este guia explica como configurar o sistema de autenticação com dois perfis: **Coordenador** (acesso total) e **Servidor do Altar** (acesso limitado).

## 1. Criar o Schema no Supabase

1. Acesse o Supabase: https://supabase.com/dashboard
2. Selecione o projeto `geuxryaynpczkfqyfxkb`
3. Vá para **SQL Editor** (lado esquerdo)
4. Crie uma nova query e copie o conteúdo de `schema-auth.sql` (no scratchpad) ou execute o SQL abaixo:

```sql
-- Tabela: Perfis de Servidores do Altar
create table if not exists servidor_profiles (
  id uuid primary key default auth.uid(),
  numero_cadastro text unique not null,
  full_name text not null,
  email text unique not null,
  perfil text default 'servidor',
  telefone text,
  endereco text,
  data_inscricao timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_user foreign key (id) references auth.users(id) on delete cascade
);

-- Tabela: Perfis de Coordenadores
create table if not exists coordenador_profiles (
  id uuid primary key default auth.uid(),
  email text unique not null,
  full_name text not null,
  perfil text default 'coordenador',
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_user foreign key (id) references auth.users(id) on delete cascade
);

-- Tabela: Formação (Temas, Assuntos, Conteúdo)
create table if not exists formacao (
  id uuid primary key default gen_random_uuid(),
  tema text not null,
  assunto text not null,
  conteudo text not null,
  fonte text,
  ordem int default 0,
  created_by uuid not null,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  constraint fk_created_by foreign key (created_by) references auth.users(id) on delete cascade
);

-- Índices para performance
create index if not exists idx_servidor_profiles_numero on servidor_profiles(numero_cadastro);
create index if not exists idx_servidor_profiles_email on servidor_profiles(email);
create index if not exists idx_formacao_tema on formacao(tema);
create index if not exists idx_formacao_created_by on formacao(created_by);

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════════════════════════════════

alter table servidor_profiles enable row level security;
create policy "Servidores podem ver seus próprios dados"
  on servidor_profiles for select
  using (auth.uid() = id or exists (select 1 from coordenador_profiles where id = auth.uid()));

create policy "Coordenadores podem gerenciar todos os servidores"
  on servidor_profiles for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()));

alter table coordenador_profiles enable row level security;
create policy "Coordenadores podem ver seus próprios dados"
  on coordenador_profiles for select
  using (auth.uid() = id);

alter table formacao enable row level security;
create policy "Todos podem ler formação"
  on formacao for select
  using (true);

create policy "Coordenadores podem criar/editar/deletar formação"
  on formacao for all
  using (exists (select 1 from coordenador_profiles where id = auth.uid()))
  with check (exists (select 1 from coordenador_profiles where id = auth.uid()) and created_by = auth.uid());
```

5. Clique em **Run** para executar o SQL.

## 2. Criar Usuários de Teste

### Coordenador de Teste

1. No Supabase, vá para **Authentication** → **Users**
2. Clique em **Add user** → **Create new user**
3. Preencha:
   - **Email**: `coordenador@test.com`
   - **Password**: `Teste123!` (senha com maiúscula e números)
   - **Auto confirm user**: ✅ (marque)
4. Clique em **Save**
5. Depois que criar o usuário, vá para **SQL Editor** e execute:

```sql
insert into coordenador_profiles (id, email, full_name)
values (
  (select id from auth.users where email = 'coordenador@test.com' limit 1),
  'coordenador@test.com',
  'Coordenador de Teste'
);
```

### Servidor do Altar de Teste (Número 001)

1. Repita o processo anterior com:
   - **Email**: `servidor@test.com`
   - **Password**: `Teste123!`
   - **Auto confirm user**: ✅
2. Vá para **SQL Editor** e execute:

```sql
insert into servidor_profiles (id, numero_cadastro, full_name, email, perfil)
values (
  (select id from auth.users where email = 'servidor@test.com' limit 1),
  '001',
  'Servidor Teste',
  'servidor@test.com',
  'servidor'
);
```

## 3. Testar o Sistema

### Login como Coordenador

1. Acesse http://localhost:5173
2. Faça login com:
   - **Email**: `coordenador@test.com`
   - **Senha**: `Teste123!`
3. Você verá **todos os menus**: Coroinhas, Acólitos, Monitores, Coordenadores, Comunidades, Agenda, **Formação Admin** e Formação
4. Clique em **Formação Admin** para gerenciar temas

### Login como Servidor do Altar

1. Acesse http://localhost:5173
2. Faça login com:
   - **Email**: `servidor@test.com`
   - **Senha**: `Teste123!`
3. Você verá **apenas**: Agenda e Formação (leitura)
4. O nome "Servidor Teste" aparece no header (ou "👤 Coordenador" se for coordenador)

## 4. Criar Novos Servidores

Para criar novos servidores com login:

1. **Coordenador** vai para **Coroinhas** (ou outra função) → **Cadastrar Novo**
2. Preenche todos os dados, incluindo:
   - **Número de Cadastro**: ex. `002`, `003`, etc.
   - **Email**: email do servidor (ele usará para login)
3. Clica em **Salvar Servidor**

Depois, você (como coordenador) precisa criar o usuário no Supabase:

1. Vá para **Authentication** → **Users** → **Add user**
2. Digite o **email** que colocou no cadastro e uma senha padrão (ex.: `Inicial123!`)
3. Execute no **SQL Editor**:

```sql
insert into servidor_profiles (id, numero_cadastro, full_name, email, perfil)
select 
  id,
  '002',  -- colocar o número certo
  'Nome Completo',  -- nome do servidor
  email,
  'servidor'
from auth.users
where email = 'novo.servidor@email.com'
and not exists (select 1 from servidor_profiles where id = auth.users.id);
```

## 5. Recursos de Formação

### Como Coordenador Cria/Edita Temas

1. Clique em **Formação Admin**
2. Clique em **Novo Item**
3. Preencha:
   - **Tema**: ex. "Cores Litúrgicas"
   - **Assunto**: ex. "O que a cor roxa representa?"
   - **Conteúdo**: ex. "Penitência, recolhimento e conversão..."
   - **Fonte**: ex. "IGMR, nn. 345-347"
4. Clique em **Salvar**

### Servidor Consulta Formação

1. Clique em **Formação** (não Admin)
2. Selecione um tema na primeira coluna
3. Selecione um assunto na segunda coluna
4. Veja o conteúdo e a fonte na terceira coluna

## 6. Recuperação de Senha

1. Na tela de login, clique em **Esqueci minha senha**
2. Digite o email e clique em **Enviar Link de Recuperação**
3. Verifique seu email (pode ir para spam)
4. Clique no link do email
5. Digite a nova senha (min. 8 chars, maiúscula e números)
6. Clique em **Atualizar Senha**
7. Será redirecionado para login

## 7. Politica de Senha

As senhas devem ter:
- ✅ Mínimo 8 caracteres
- ✅ Pelo menos uma letra maiúscula
- ✅ Pelo menos um número
- Exemplo: `Servidor123`, `Altar2024`, `Formacao99`

## 8. Configuração de Email (Opcional)

O Supabase vem com um email padrão. Para customizar (logo da igleja, cores, etc.):

1. Vá para **Email Templates** no Supabase
2. Edite o template de **"Password Reset"** com seu design

## 9. Troubleshooting

| Problema | Solução |
|----------|---------|
| "Email ou senha incorretos" | Verifique se o email existe na tabela `auth.users` e se a senha está correta |
| Servidor não vê "Formação" | Certifique-se que há dados na tabela `formacao` criados por um coordenador |
| Link de reset não funciona | Verifique se a URL de redirect está correta (padrão: `http://localhost:5173/#/reset-senha`) |
| Coordenador não vê "Formação Admin" | Verifique se existe registro em `coordenador_profiles` para o usuário |

## 10. Próximos Passos

Quando for publicar na Hostinger:

1. Atualize as variáveis de ambiente `.env` com a URL correta
2. Mude a URL de redirect de reset de senha para o domínio produção (ex: `https://servidoresdoaltar.site/#/reset-senha`)
3. Configure o SMTP do Supabase com um email real (admin@paroquia.com.br, por exemplo)
4. Crie usuários reais via Supabase Auth, não use dados de teste

---

**Dúvidas?** Este sistema usa Supabase Auth nativo, que é robusto e gratuito. Se precisar de mais funcionalidades (2FA, OAuth com Google, etc), está tudo disponível no Supabase.
