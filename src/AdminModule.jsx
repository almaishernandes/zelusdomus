import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Settings, RefreshCw } from 'lucide-react';

// Painel de administração dentro do próprio app — só aparece pra quem já é
// "suporte" (perfil.is_suporte). Cada ação chama /api/admin, que confere de
// novo no servidor se quem está logado é suporte antes de usar a chave
// service_role (o navegador nunca vê essa chave).
async function chamar(method, action, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/admin?action=${action}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session?.access_token || ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok || json.erro) throw new Error(json.erro || 'Erro na operação.');
  return json;
}

const inputStyle = { width: '100%', padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: '0.85rem' };
const labelStyle = { display: 'block', fontSize: '0.78rem', fontWeight: 700, margin: '0.6rem 0 0.2rem', color: '#475569' };
const secaoStyle = { background: '#fff', borderRadius: 8, padding: '1.2rem 1.4rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '1.2rem' };
const btnStyle = { background: '#2563eb', color: '#fff', border: 0, padding: '0.55rem 1rem', borderRadius: 5, fontWeight: 700, cursor: 'pointer', marginTop: '0.8rem', fontSize: '0.85rem' };
const btnSecStyle = { ...btnStyle, background: '#e2e8f0', color: '#1e293b', margin: 0, padding: '0.3rem 0.6rem', fontSize: '0.78rem' };

function Msg({ texto, ok }) {
  if (!texto) return null;
  return (
    <div style={{ marginTop: '0.8rem', padding: '0.6rem 0.8rem', borderRadius: 5, fontSize: '0.85rem', whiteSpace: 'pre-wrap', background: ok ? '#dcfce7' : '#fee2e2', color: ok ? '#166534' : '#991b1b' }}>
      {texto}
    </div>
  );
}

export function AdminModule() {
  const [paroquias, setParoquias] = useState([]);
  const [counts, setCounts] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');

  const carregarParoquias = useCallback(async () => {
    setCarregando(true);
    setErroGeral('');
    try {
      const r = await chamar('GET', 'paroquias');
      setParoquias(r.paroquias);
      setCounts(r.counts);
    } catch (err) {
      setErroGeral(err.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregarParoquias(); }, [carregarParoquias]);

  const excluirParoquia = async (id, nome) => {
    if (!window.confirm(`Excluir a paróquia "${nome}"? Só funciona se ela não tiver servidores/comunidades.`)) return;
    try { await chamar('DELETE', 'paroquias', { id }); carregarParoquias(); }
    catch (err) { window.alert(err.message); }
  };
  const alternarAtiva = async (id, ativa) => {
    try { await chamar('PATCH', 'paroquias', { id, ativa }); carregarParoquias(); }
    catch (err) { window.alert(err.message); }
  };

  const [npNome, setNpNome] = useState(''); const [npCidade, setNpCidade] = useState(''); const [npDiocese, setNpDiocese] = useState('');
  const [npMsg, setNpMsg] = useState(null);
  const criarParoquia = async () => {
    setNpMsg(null);
    try {
      await chamar('POST', 'paroquias', { nome: npNome, cidade: npCidade, diocese: npDiocese });
      setNpNome(''); setNpCidade(''); setNpDiocese('');
      setNpMsg({ texto: 'Paróquia criada.', ok: true });
      carregarParoquias();
    } catch (err) { setNpMsg({ texto: err.message, ok: false }); }
  };

  const [ncParoquia, setNcParoquia] = useState(''); const [ncNome, setNcNome] = useState(''); const [ncCadastro, setNcCadastro] = useState('');
  const [ncEmail, setNcEmail] = useState(''); const [ncSenha, setNcSenha] = useState(''); const [ncMsg, setNcMsg] = useState(null);
  useEffect(() => { if (!ncParoquia && paroquias.length) setNcParoquia(paroquias[0].id); }, [paroquias, ncParoquia]);
  const criarCoordenador = async () => {
    setNcMsg(null);
    try {
      const r = await chamar('POST', 'coordenador', { paroquia_id: ncParoquia, full_name: ncNome, numero_cadastro: ncCadastro, email: ncEmail, senha: ncSenha });
      setNcMsg({ texto: `Coordenador criado!\nE-mail: ${r.email}\nSenha temporária: ${r.senha}\n\nRepasse e peça para trocar em "Esqueci minha senha".`, ok: true });
      setNcNome(''); setNcCadastro(''); setNcEmail(''); setNcSenha('');
    } catch (err) { setNcMsg({ texto: err.message, ok: false }); }
  };

  const [spEmail, setSpEmail] = useState(''); const [spMsg, setSpMsg] = useState(null);
  const tornarSuporte = async () => {
    setSpMsg(null);
    try {
      await chamar('POST', 'suporte', { email: spEmail });
      setSpMsg({ texto: 'Agora é suporte — já pode logar no app e trocar de paróquia no cabeçalho.', ok: true });
      setSpEmail('');
    } catch (err) { setSpMsg({ texto: err.message, ok: false }); }
  };

  const [rsEmail, setRsEmail] = useState(''); const [rsSenha, setRsSenha] = useState(''); const [rsMsg, setRsMsg] = useState(null);
  const resetarSenha = async () => {
    setRsMsg(null);
    try {
      const r = await chamar('POST', 'reset-senha', { email: rsEmail, senha: rsSenha });
      setRsMsg({ texto: `Senha redefinida.\nE-mail: ${r.email}\nNova senha: ${r.senha}`, ok: true });
      setRsSenha('');
    } catch (err) { setRsMsg({ texto: err.message, ok: false }); }
  };

  const [vdParoquia, setVdParoquia] = useState(''); const [vdDados, setVdDados] = useState(null); const [vdErro, setVdErro] = useState('');
  useEffect(() => {
    if (!vdParoquia) { setVdDados(null); return; }
    (async () => {
      setVdErro(''); setVdDados(null);
      try {
        const r = await chamar('GET', `dados&paroquia_id=${vdParoquia}`);
        setVdDados(r);
      } catch (err) { setVdErro(err.message); }
    })();
  }, [vdParoquia]);

  return (
    <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
        <Settings size={16} /> Painel de administração — acesso restrito ao suporte. Opera direto no banco de dados, sem as validações normais do app.
      </div>

      <div style={secaoStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Paróquias</h3>
          <button onClick={carregarParoquias} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', display: 'flex' }} title="Atualizar">
            <RefreshCw size={16} />
          </button>
        </div>
        {erroGeral && <Msg texto={erroGeral} ok={false} />}
        {carregando ? <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Carregando…</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '0.8rem' }}>
            <thead><tr>
              {['Nome', 'Cidade', 'Servidores', 'Comunidades', 'Ativa', ''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {paroquias.map(p => {
                const c = counts[p.id] || {};
                return (
                  <tr key={p.id}>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>{p.nome}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>{p.cidade || ''}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>{c.servidores ?? 0}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>{c.comunidades ?? 0}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0' }}>{p.ativa ? 'sim' : 'não'}</td>
                    <td style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      <button onClick={() => alternarAtiva(p.id, !p.ativa)} style={btnSecStyle}>{p.ativa ? 'desativar' : 'ativar'}</button>{' '}
                      <button onClick={() => excluirParoquia(p.id, p.nome)} style={{ ...btnSecStyle, color: '#991b1b' }}>excluir</button>
                    </td>
                  </tr>
                );
              })}
              {paroquias.length === 0 && <tr><td colSpan={6} style={{ padding: '0.8rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma paróquia cadastrada.</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <div style={secaoStyle}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Nova paróquia</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <div><label style={labelStyle}>Nome *</label><input style={inputStyle} value={npNome} onChange={e => setNpNome(e.target.value)} /></div>
          <div><label style={labelStyle}>Cidade</label><input style={inputStyle} value={npCidade} onChange={e => setNpCidade(e.target.value)} /></div>
        </div>
        <label style={labelStyle}>Diocese</label><input style={inputStyle} value={npDiocese} onChange={e => setNpDiocese(e.target.value)} />
        <div><button onClick={criarParoquia} style={btnStyle}>Criar paróquia</button></div>
        {npMsg && <Msg {...npMsg} />}
      </div>

      <div style={secaoStyle}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Novo coordenador</h3>
        <label style={labelStyle}>Paróquia *</label>
        <select style={inputStyle} value={ncParoquia} onChange={e => setNcParoquia(e.target.value)}>
          {paroquias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <div><label style={labelStyle}>Nome completo *</label><input style={inputStyle} value={ncNome} onChange={e => setNcNome(e.target.value)} /></div>
          <div><label style={labelStyle}>Nº cadastro</label><input style={inputStyle} placeholder="001" value={ncCadastro} onChange={e => setNcCadastro(e.target.value)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <div><label style={labelStyle}>E-mail *</label><input type="email" style={inputStyle} value={ncEmail} onChange={e => setNcEmail(e.target.value)} /></div>
          <div><label style={labelStyle}>Senha (vazio = gerar)</label><input style={inputStyle} value={ncSenha} onChange={e => setNcSenha(e.target.value)} /></div>
        </div>
        <div><button onClick={criarCoordenador} style={btnStyle}>Criar coordenador</button></div>
        {ncMsg && <Msg {...ncMsg} />}
      </div>

      <div style={secaoStyle}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Tornar suporte (acesso a todas as paróquias)</h3>
        <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.4rem' }}>A pessoa precisa já ser coordenador de alguma paróquia. Depois disso, um seletor de paróquia aparece pra ela no cabeçalho do app.</p>
        <label style={labelStyle}>E-mail do coordenador *</label>
        <input type="email" style={inputStyle} value={spEmail} onChange={e => setSpEmail(e.target.value)} />
        <div><button onClick={tornarSuporte} style={btnStyle}>Tornar suporte</button></div>
        {spMsg && <Msg {...spMsg} />}
      </div>

      <div style={secaoStyle}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Resetar senha</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
          <div><label style={labelStyle}>E-mail do usuário *</label><input type="email" style={inputStyle} value={rsEmail} onChange={e => setRsEmail(e.target.value)} /></div>
          <div><label style={labelStyle}>Nova senha (vazio = gerar)</label><input style={inputStyle} value={rsSenha} onChange={e => setRsSenha(e.target.value)} /></div>
        </div>
        <div><button onClick={resetarSenha} style={btnStyle}>Definir nova senha</button></div>
        {rsMsg && <Msg {...rsMsg} />}
      </div>

      <div style={secaoStyle}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Ver dados de uma paróquia</h3>
        <label style={labelStyle}>Paróquia</label>
        <select style={inputStyle} value={vdParoquia} onChange={e => setVdParoquia(e.target.value)}>
          <option value="">-- Selecione --</option>
          {paroquias.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#334155' }}>
          {vdErro && <Msg texto={vdErro} ok={false} />}
          {!vdParoquia && <p style={{ color: '#64748b' }}>Selecione uma paróquia.</p>}
          {vdParoquia && !vdDados && !vdErro && <p style={{ color: '#64748b' }}>Carregando…</p>}
          {vdDados && (
            <>
              <p><strong>Coordenadores:</strong> {vdDados.coordenadores.map(c => `${c.full_name} · ${c.email}`).join(', ') || '—'}</p>
              <p><strong>Servidores ({vdDados.servers.length}):</strong> {vdDados.servers.map(s => `${s.cadastro ? s.cadastro + ' ' : ''}${s.full_name || ''}`).join(', ') || '—'}</p>
              <p><strong>Comunidades ({vdDados.communities.length}):</strong> {vdDados.communities.map(c => c.name).join(', ') || '—'}</p>
              <p><strong>Livro caixa:</strong> {vdDados.lancamentos.length} lançamentos · saldo R$ {vdDados.saldo.toFixed(2)}</p>
              <p><strong>Formação:</strong> {vdDados.formacao.length} itens · <strong>Atas:</strong> {vdDados.atas.length}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
