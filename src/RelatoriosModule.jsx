import React, { useState, useEffect } from 'react';
import { Users, Church, Cake, ClipboardList } from 'lucide-react';

const TIPOS = [
  { key: 'coroinha', label: 'Coroinhas' },
  { key: 'acolito', label: 'Acólitos' },
  { key: 'monitor', label: 'Monitores' },
  { key: 'cerimoniario', label: 'Cerimoniários' },
  { key: 'coordenador', label: 'Coordenadores' }
];
const TYPE_LABEL = { coroinha: 'Coroinha', acolito: 'Acólito', monitor: 'Monitor', cerimoniario: 'Cerimoniário', coordenador: 'Coordenador' };
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const comunidadesAtua = (s) => {
  try { return JSON.parse(s.community_atua || '[]'); } catch { return []; }
};

const fmtDataCurta = (dobStr) => {
  const d = new Date(dobStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const calcIdade = (dobStr) => {
  const dob = new Date(dobStr + 'T00:00:00');
  const hoje = new Date();
  let idade = hoje.getFullYear() - dob.getFullYear();
  const aindaNaoFezAniversario = hoje.getMonth() < dob.getMonth() || (hoje.getMonth() === dob.getMonth() && hoje.getDate() < dob.getDate());
  if (aindaNaoFezAniversario) idade--;
  return idade;
};

// Ordena por número de cadastro (numérico quando possível, senão texto)
const porCadastro = (a, b) => {
  const na = parseInt(a.cadastro, 10), nb = parseInt(b.cadastro, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a.cadastro || '').localeCompare(String(b.cadastro || ''));
};

const th = { textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' };
const td = { padding: '0.35rem 0.9rem', color: '#64748b' };

export function RelatoriosModule({ servers = [], communities = [], setHeaderExtra }) {
  const [visao, setVisao] = useState('porFuncao'); // 'porFuncao' | 'servidores' | 'aniversariantes'
  const [mesAniversario, setMesAniversario] = useState(new Date().getMonth());
  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };

  // Botões de relatório injetados na 1ª linha do cabeçalho do app, ao lado de Sair.
  useEffect(() => {
    if (!setHeaderExtra) return;
    const btn = (ativo) => ({
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      background: ativo ? '#0f766e' : '#94a3b8', color: '#fff', border: 'none',
      padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700
    });
    setHeaderExtra(
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button type="button" onClick={() => setVisao('aniversariantes')} style={btn(visao === 'aniversariantes')}>
          <Cake size={14} /> Aniversariantes
        </button>
        <button type="button" onClick={() => setVisao('servidores')} style={btn(visao === 'servidores')}>
          <Users size={14} /> Relação Servidores
        </button>
        <button type="button" onClick={() => setVisao('porFuncao')} style={btn(visao === 'porFuncao')}>
          <ClipboardList size={14} /> Relação por Função
        </button>
      </div>
    );
    return () => setHeaderExtra(null);
  }, [setHeaderExtra, visao]);

  const listaPorTipo = (tipo) => servers
    .filter(s => s.type === tipo)
    .slice()
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  // Uma pessoa pode ter uma linha por função (coroinha, acólito...) — deduplica
  // por pessoa antes de listar aniversariantes, para não repetir o mesmo nome.
  const servidoresUnicos = React.useMemo(() => {
    const seen = new Set(); const out = [];
    servers.forEach(s => {
      const pid = s.person_id || s.id;
      if (!seen.has(pid)) { seen.add(pid); out.push(s); }
    });
    return out;
  }, [servers]);

  const aniversariantesDoMes = servidoresUnicos
    .filter(s => s.dob && new Date(s.dob + 'T00:00:00').getMonth() === mesAniversario)
    .sort((a, b) => new Date(a.dob + 'T00:00:00').getDate() - new Date(b.dob + 'T00:00:00').getDate());

  const todosServidoresOrdenados = servers.slice().sort(porCadastro);

  if (visao === 'aniversariantes') {
    return (
      <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem' }}>
        <div style={secaoStyle}>
          <div style={{ ...tituloStyle, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Cake size={15} /> Aniversariantes ({aniversariantesDoMes.length})</span>
            <select value={mesAniversario} onChange={e => setMesAniversario(Number(e.target.value))}
              style={{ padding: '0.25rem 0.5rem', borderRadius: 4, border: 'none', fontSize: '0.8rem', fontWeight: 600 }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Função</th>
                <th style={th}>Data de Aniversário</th>
                <th style={th}>Idade</th>
                <th style={th}>WhatsApp</th>
                <th style={th}>E-mail</th>
                <th style={th}>Comunidade que Atua</th>
              </tr>
            </thead>
            <tbody>
              {aniversariantesDoMes.map((s, i) => (
                <tr key={s.person_id || s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                  <td style={td}>{TYPE_LABEL[s.type] || s.type}</td>
                  <td style={td}>{fmtDataCurta(s.dob)}</td>
                  <td style={td}>{calcIdade(s.dob)}</td>
                  <td style={td}>{s.phone || '-'}</td>
                  <td style={td}>{s.email || '-'}</td>
                  <td style={td}>{comunidadesAtua(s).join(', ') || '-'}</td>
                </tr>
              ))}
              {aniversariantesDoMes.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum aniversariante em {MESES[mesAniversario]}.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (visao === 'servidores') {
    return (
      <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem' }}>
        <div style={secaoStyle}>
          <div style={tituloStyle}><Users size={15} /> Relação de Servidores ({todosServidoresOrdenados.length})</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={th}>Cadastro</th>
                <th style={th}>Nome</th>
                <th style={th}>Função</th>
                <th style={th}>WhatsApp</th>
                <th style={th}>E-mail</th>
                <th style={th}>Comunidade que Atua</th>
              </tr>
            </thead>
            <tbody>
              {todosServidoresOrdenados.map((s, i) => (
                <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={td}>{s.cadastro || '-'}</td>
                  <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                  <td style={td}>{TYPE_LABEL[s.type] || s.type}</td>
                  <td style={td}>{s.phone || '-'}</td>
                  <td style={td}>{s.email || '-'}</td>
                  <td style={td}>{comunidadesAtua(s).join(', ') || '-'}</td>
                </tr>
              ))}
              {todosServidoresOrdenados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum servidor cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem' }}>
      {TIPOS.map(({ key, label }) => {
        const lista = listaPorTipo(key);
        return (
          <div key={key} style={secaoStyle}>
            <div style={tituloStyle}><Users size={15} /> {label} ({lista.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={th}>Cadastro</th>
                  <th style={th}>Nome</th>
                  <th style={th}>WhatsApp</th>
                  <th style={th}>E-mail</th>
                  <th style={th}>Comunidade que Atua</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={td}>{s.cadastro || '-'}</td>
                    <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                    <td style={td}>{s.phone || '-'}</td>
                    <td style={td}>{s.email || '-'}</td>
                    <td style={td}>{comunidadesAtua(s).join(', ') || '-'}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum(a) {label.toLowerCase()} cadastrado(a).</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      <div style={secaoStyle}>
        <div style={tituloStyle}><Church size={15} /> Comunidades ({communities.length})</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={th}>Nome</th>
              <th style={th}>Endereço</th>
            </tr>
          </thead>
          <tbody>
            {communities.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c, i) => (
              <tr key={c.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{c.name}</td>
                <td style={td}>{c.address || '-'}</td>
              </tr>
            ))}
            {communities.length === 0 && (
              <tr><td colSpan={2} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma comunidade cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
