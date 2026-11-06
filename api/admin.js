// Painel de administração — agora acessível pela internet, mas só para quem
// já é "suporte" no app (coordenador com is_suporte = true). Toda ação exige
// o token de uma sessão real já autenticada; a chave service_role (que
// ignora o RLS) nunca chega ao navegador — ela só existe aqui, no servidor.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const supa = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

function gerarSenha() {
  const p = ['Altar', 'Servo', 'Fe', 'Luz', 'Paz', 'Cruz'][Math.floor(Math.random() * 6)];
  return `${p}@${Math.floor(1000 + Math.random() * 9000)}`;
}

// Confere o token enviado pelo app e se quem está logado é mesmo "suporte".
async function exigirSuporte(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) throw Object.assign(new Error('Não autenticado.'), { status: 401 });

  const { data, error } = await supa.auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error('Sessão inválida.'), { status: 401 });

  const { data: perfil } = await supa.from('coordenador_profiles').select('is_suporte').eq('id', data.user.id).maybeSingle();
  if (!perfil?.is_suporte) throw Object.assign(new Error('Acesso restrito ao suporte.'), { status: 403 });
}

const handlers = {
  async 'GET /paroquias'() {
    const { data, error } = await supa.from('paroquias').select('*').order('nome');
    if (error) throw error;
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

  async 'POST /paroquias'(body) {
    const { nome, cidade, diocese } = body;
    if (!nome?.trim()) throw new Error('Informe o nome da paróquia.');
    const { data, error } = await supa.from('paroquias')
      .insert({ nome: nome.trim(), cidade: cidade?.trim() || null, diocese: diocese?.trim() || null })
      .select().single();
    if (error) throw error;
    return { paroquia: data };
  },

  async 'DELETE /paroquias'(body) {
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

  async 'PATCH /paroquias'(body) {
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

  async 'POST /coordenador'(body) {
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
      await supa.auth.admin.deleteUser(uid);
      throw pErr;
    }
    return { email: email.trim(), senha: senhaFinal };
  },

  async 'POST /suporte'(body) {
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

  async 'POST /reset-senha'(body) {
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

  async 'GET /dados'(body, query) {
    const pid = query.paroquia_id;
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

export default async function handler(req, res) {
  if (!supa) {
    res.status(500).json({ erro: 'Painel admin não configurado neste ambiente (faltam variáveis de ambiente no servidor).' });
    return;
  }
  try {
    await exigirSuporte(req);
    const action = req.query.action;
    const key = `${req.method} /${action}`;
    const fn = handlers[key];
    if (!fn) { res.status(404).json({ erro: 'Ação inválida.' }); return; }
    const result = await fn(req.body || {}, req.query);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 400).json({ erro: err.message || String(err) });
  }
}
