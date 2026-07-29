# Mudanças Implementadas — Autenticação e Permissões

## 🎯 Resumo Executivo

ZelusDomus agora é um sistema **multi-usuário robusto** com:
- ✅ **Autenticação segura** com Supabase Auth
- ✅ **Dois perfis** de acesso: Coordenador (admin) e Servidor do Altar (leitura)
- ✅ **Banco de dados** para temas de formação (CRUD)
- ✅ **Recuperação de senha** por email
- ✅ **Política de senha forte** (8+ chars, maiúscula, número)

---

## 📁 Arquivos Criados

### Contexto de Autenticação
- **`src/AuthContext.jsx`** — Gerencia autenticação, login, logout, recuperação de senha
  - Hook `useAuth()` para acessar user, perfil, funções

### Componentes de Login
- **`src/LoginPage.jsx`** — Tela de login + "Esqueci a senha"
- **`src/ResetPasswordPage.jsx`** — Tela de redefinição de senha por email

### Módulos de Formação
- **`src/FormacaoModule.jsx`** — Formação de **leitura** (servidor + coordenador) em 3 colunas
  - Carrega do banco de dados (`formacao` table)
  - Grupos por tema, seleciona assunto, exibe conteúdo + fonte

- **`src/FormacaoAdminModule.jsx`** — Formação de **CRUD** (coordenador apenas)
  - Criar novos temas/assuntos
  - Editar conteúdo e fonte
  - Deletar itens

### Documentação
- **`SETUP-AUTENTICACAO.md`** — Guia passo-a-passo para configurar
  - SQL a executar no Supabase
  - Como criar usuários de teste
  - Como usar cada perfil
  - Recuperação de senha
  - Troubleshooting

---

## 🔄 Mudanças no App.jsx

1. **Imports**: adicionados `AuthProvider`, `useAuth`, `LoginPage`, novos módulos de formação
2. **Estrutura**: 
   - `function AppContent()` — app original com autenticação
   - `function AppWithAuth()` — wrapper com `<AuthProvider>`
   - Export: `AppWithAuth` (era `App`)
3. **Filtro de menus**:
   - **Coordenador**: vê todos os menus (Coroinhas, Acolitos, Monitores, Coordenadores, Comunidades, Agenda, **Formação Admin**, Formação)
   - **Servidor**: vê apenas (Agenda, Formação)
4. **Header**: adicionado botão **Sair** + indicador de perfil (nome ou "Coordenador")
5. **Renderização condicional**: mostra `LoginPage` se não autenticado

---

## 🗄️ Schema Supabase

### Tabelas Novas

| Tabela | Campos | Propósito |
|--------|--------|----------|
| `servidor_profiles` | id, numero_cadastro, full_name, email, perfil, telefone, endereco | Perfil do servidor do altar |
| `coordenador_profiles` | id, email, full_name, perfil | Perfil do coordenador |
| `formacao` | id, tema, assunto, conteudo, fonte, ordem, created_by | Temas de formação |

### Row Level Security (RLS)

Política de acesso:
- **`servidor_profiles`**: Servidor vê só seu registro; Coordenador vê todos
- **`coordenador_profiles`**: Coordenador vê seu próprio registro
- **`formacao`**: Todos leem; Coordenador cria/edita/deleta

---

## 🔐 Autenticação & Autorização

### Fluxo de Login

```
User digita email + senha
           ↓
Supabase Auth verifica
           ↓
Se OK → Verifica se existe em servidor_profiles ou coordenador_profiles
           ↓
Carrega perfil (tipo: 'servidor' ou 'coordenador')
           ↓
AuthContext armazena { user, perfil, eAutenticado }
           ↓
App filtra menus conforme perfil
```

### Funções Disponíveis (useAuth)

```javascript
const { 
  user,                  // { id, email }
  perfil,               // { tipo, full_name, numero_cadastro }
  eAutenticado,         // boolean
  ehCoordenador,        // boolean
  ehServidor,           // boolean
  login(email, senha),  // → { sucesso, erro }
  logout(),
  solicitarReset(email),  // → { sucesso, erro }
  atualizarSenha(novaSenha)
} = useAuth();
```

---

## 🔑 Política de Senha

**Requisitos**:
- ✅ Mínimo **8 caracteres**
- ✅ Pelo menos **1 letra maiúscula** (A-Z)
- ✅ Pelo menos **1 número** (0-9)
- ❌ Sem limite máximo

**Exemplos válidos**:
- `Servidor123`
- `Altar2024`
- `Formacao99`

**Validação**: Feita no frontend (LoginPage, ResetPasswordPage) e no Supabase Auth (backend)

---

## 🚀 Como Usar

### Para o Coordenador

1. **Acessar App**: Login com email + senha de coordenador
2. **Gerenciar Servidores**: Coroinhas, Acólitos, Monitores, etc. (igual antes)
3. **Gerenciar Comunidades**: Igual antes
4. **Formação Admin**: 
   - Clique em "Formação Admin"
   - Clique em "+ Novo Item"
   - Preencha Tema, Assunto, Conteúdo, Fonte
   - Clique em "Salvar"
5. **Sair**: Clique em "Sair" no header

### Para o Servidor do Altar

1. **Acessar App**: Login com número de cadastro (email) + senha
2. **Visualizar Agenda**: Próximas 6 meses com participações
3. **Consultar Formação**: Veja temas, assuntos e conteúdo (não pode editar)
4. **Recuperação de Senha**: Clique em "Esqueci minha senha", recebe email
5. **Sair**: Clique em "Sair" no header

---

## 📊 Dados de Teste

| Perfil | Email | Senha | Acesso |
|--------|-------|-------|--------|
| Coordenador | coordenador@test.com | Teste123! | Todos os menus |
| Servidor #001 | servidor@test.com | Teste123! | Agenda, Formação |

---

## 🛠️ Próximas Integrações Possíveis

1. **Edição de Perfil do Servidor**: Nome, telefone, endereço
2. **Duas Fatores (2FA)**: Autentic app ou SMS
3. **OAuth com Google**: Login simplificado
4. **Importação em Massa**: Criar múltiplos servidores de CSV
5. **Notificações**: Email quando escalado para uma missa
6. **Dashboard do Coordenador**: Estatísticas (servidores cadastrados, participações, etc)

---

## ⚠️ Considerações de Segurança

✅ **Senhas** armazenadas com hash pelo Supabase (bcrypt)
✅ **RLS** impede que servidor veja dados de outros
✅ **JWT** tokens expira automaticamente (Supabase, 1 hora)
✅ **Email** é obrigatório e verificável
✅ **Reset token** expira em 1 hora (padrão Supabase)

---

## 🧪 Testes Recomendados

- [ ] Login com email + senha (coordenador)
- [ ] Login com email + senha (servidor)
- [ ] Logout
- [ ] Esquecer senha + reset por email
- [ ] Tentar acessar menu bloqueado (servidor não vê Coroinhas)
- [ ] Coordenador cria novo tema de formação
- [ ] Servidor visualiza novo tema
- [ ] Coordenador edita/deleta tema
- [ ] Criando novo servidor → recebe email de reset

---

## 📝 Notas para Produção

1. **URL de Reset**: Mude em `LoginPage.jsx` de `http://localhost` para domínio real
2. **Email SMTP**: Configure no Supabase para enviar de `noreply@seudomain.com`
3. **HTTPS**: Obrigatório para autenticação em produção
4. **Backup**: Configure backup automático da base Supabase
5. **Documentação**: Gere senhas iniciais temporárias para novos coordenadores/servidores

---

**Última atualização**: 2026-07-20
**Desenvolvido com**: React, Supabase Auth, Supabase PostgreSQL
