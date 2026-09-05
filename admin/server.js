// Painel de administração LOCAL do ZelusDomus.
// Roda só na sua máquina. Usa a service_role key (que ignora o RLS), por isso
// NUNCA deve ser publicado nem ter a chave versionada.
//
//   npm run admin
//
// Requisitos: Node 20+ (usa --env-file, sem dependências extras além de supabase-js).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_PORT } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\n  Falta configurar admin/.env.local (veja admin/.env.local.example)\n');
  process.exit(1);
}

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PORT = Number(ADMIN_PORT) || 8787;

// ── Handlers da API ──────────────────────────────────────────────────────
const api = {
  async 'GET /api/paroquias'() {
    const { data, error } = await supa.from('paroquias').select('*').order('nome');
    if (error) throw error;
    // contagem de servidores/comunidades por paróquia
    const counts = {};
    for (const p of data) {
      const [{ count: srv }, { count: com }] = await Promise.all([
        supa.from('servers').select('*', { count: 'exact', head: true }).eq('paroquia_id', p.id),
        supa.from('communities').select('*', { count: 'exact', head: true }).eq('paroquia_id', p.id),
      ]);
      counts[p.id] = { servidores: srv || 0, comunidades: com || 0 };
    }
    return { paroquias: data, counts };
  },

  async 'POST /api/paroquias'(body) {
    const { nome, cidade, diocese } = body;
    if (!nome?.trim()) throw new Error('Informe o nome da paróquia.');
    const { data, error } = await supa.from('paroquias')
      .insert({ nome: nome.trim(), cidade: cidade?.trim() || null, diocese: diocese?.trim() || null })
      .select().single();
    if (error) throw error;
    return { paroquia: data };
  },

  async 'DELETE /api/paroquias'(body) {
    const { id } = body;
    if (!id) throw new Error('id obrigatório');
    const [{ count: srv }, { count: com }] = await Promise.all([
      supa.from('servers').select('*', { count: 'exact', head: true }).eq('paroquia_id', id),
      supa.from('communities').select('*', { count: 'exact', head: true }).eq('paroquia_id', id),
    ]);
    if ((srv || 0) > 0 || (com || 0) > 0) {
      throw new Error('Só é possível excluir paróquias sem servidores/comunidades.');
    }
    const { error } = await supa.from('paroquias').delete().eq('id', id);
    if (error) throw error;
    return { ok: true };
  },

  async 'PATCH /api/paroquias'(body) {
    const { id, nome, cidade, diocese, ativa } = body;
    if (!id) throw new Error('id obrigatório');
    const patch = {};
    if (nome !== undefined) patch.nome = nome.trim();
    if (cidade !== undefined) patch.cidade = cidade?.trim() || null;
    if (diocese !== undefined) patch.diocese = diocese?.trim() || null;
    if (ativa !== undefined) patch.ativa = !!ativa;
    const { data, error } = await supa.from('paroquias').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return { paroquia: data };
  },

  async 'POST /api/coordenador'(body) {
    const { paroquia_id, email, full_name, numero_cadastro, senha } = body;
    if (!paroquia_id || !email?.trim() || !full_name?.trim()) {
      throw new Error('Paróquia, e-mail e nome são obrigatórios.');
    }
    const senhaFinal = senha?.trim() || gerarSenha();
    const { data: created, error: cErr } = await supa.auth.admin.createUser({
      email: email.trim(), password: senhaFinal, email_confirm: true,
    });
    if (cErr) throw cErr;
    const uid = created.user.id;
    const { error: pErr } = await supa.from('coordenador_profiles').insert({
      id: uid, email: email.trim(), full_name: full_name.trim(),
      numero_cadastro: numero_cadastro?.trim() || null, perfil: 'coordenador', paroquia_id,
    });
    if (pErr) {
      await supa.auth.admin.deleteUser(uid); // desfaz a conta se o perfil falhar
      throw pErr;
    }
    return { email: email.trim(), senha: senhaFinal };
  },

  async 'POST /api/suporte'(body) {
    const { email } = body;
    if (!email?.trim()) throw new Error('Informe o e-mail.');
    const { data: perfil, error: fErr } = await supa.from('coordenador_profiles')
      .select('id, paroquia_id').eq('email', email.trim()).maybeSingle();
    if (fErr) throw fErr;
    if (!perfil) throw new Error('Nenhum coordenador com esse e-mail. Crie o coordenador primeiro.');
    const { error } = await supa.from('coordenador_profiles')
      .update({ is_suporte: true, paroquia_ativa_id: perfil.paroquia_id })
      .eq('id', perfil.id);
    if (error) throw error;
    return { ok: true };
  },

  async 'POST /api/reset-senha'(body) {
    const { email, senha } = body;
    if (!email?.trim()) throw new Error('Informe o e-mail.');
    const { data: list, error: lErr } = await supa.auth.admin.listUsers({ perPage: 1000 });
    if (lErr) throw lErr;
    const user = list.users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error('Nenhum usuário com esse e-mail.');
    const senhaFinal = senha?.trim() || gerarSenha();
    const { error } = await supa.auth.admin.updateUserById(user.id, { password: senhaFinal });
    if (error) throw error;
    return { email: email.trim(), senha: senhaFinal };
  },

  async 'GET /api/dados'(body, url) {
    const pid = url.searchParams.get('paroquia_id');
    if (!pid) throw new Error('paroquia_id obrigatório');
    const [servers, communities, lancamentos, formacao, atas, coordenadores] = await Promise.all([
      supa.from('servers').select('*').eq('paroquia_id', pid).order('full_name'),
      supa.from('communities').select('*').eq('paroquia_id', pid).order('name'),
      supa.from('livro_caixa_lancamentos').select('*').eq('paroquia_id', pid).order('emissao', { ascending: false }),
      supa.from('formacao').select('id,tema,assunto').eq('paroquia_id', pid),
      supa.from('atas_reuniao').select('id,tema,assunto').eq('paroquia_id', pid),
      supa.from('coordenador_profiles').select('email,full_name,numero_cadastro').eq('paroquia_id', pid),
    ]);
    const saldo = (lancamentos.data || []).reduce((s, l) => s + Number(l.credito || 0) - Number(l.debito || 0), 0);
    return {
      coordenadores: coordenadores.data || [],
      servers: servers.data || [],
      communities: communities.data || [],
      lancamentos: lancamentos.data || [],
      saldo,
      formacao: formacao.data || [],
      atas: atas.data || [],
    };
  },
};

function gerarSenha() {
  const p = ['Altar', 'Servo', 'Fe', 'Luz', 'Paz', 'Cruz'][Math.floor(Math.random() * 6)];
  return `${p}@${Math.floor(1000 + Math.random() * 9000)}`;
}

// ── HTTP ─────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const key = `${req.method} ${url.pathname}`;

  if (key === 'GET /' || url.pathname === '/index.html') {
    try {
      const html = await readFile(join(__dirname, 'ui.html'), 'utf8');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch {
      res.writeHead(500); return res.end('ui.html não encontrado');
    }
  }

  const handler = api[key];
  if (!handler) { res.writeHead(404); return res.end('não encontrado'); }

  try {
    let body = {};
    if (req.method !== 'GET') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString());
    }
    const result = await handler(body, url);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ erro: err.message || String(err) }));
  }
});

server.listen(PORT, () => {
  console.log(`\n  ZelusDomus · Painel de administração`);
  console.log(`  → http://localhost:${PORT}\n`);
});
