import React, { useState } from 'react';
import { Users, Church, Cake } from 'lucide-react';

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

export function RelatoriosModule({ servers = [], communities = [] }) {
  const [mesAniversario, setMesAniversario] = useState(new Date().getMonth());
  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };

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
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Dia</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Função</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>WhatsApp</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>E-mail</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Comunidade que Atua</th>
            </tr>
          </thead>
          <tbody>
            {aniversariantesDoMes.map((s, i) => (
              <tr key={s.person_id || s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{String(new Date(s.dob + 'T00:00:00').getDate()).padStart(2, '0')}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{TYPE_LABEL[s.type] || s.type}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.phone || '-'}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.email || '-'}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{comunidadesAtua(s).join(', ') || '-'}</td>
              </tr>
            ))}
            {aniversariantesDoMes.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum aniversariante em {MESES[mesAniversario]}.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {TIPOS.map(({ key, label }) => {
        const lista = listaPorTipo(key);
        return (
          <div key={key} style={secaoStyle}>
            <div style={tituloStyle}><Users size={15} /> {label} ({lista.length})</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Cadastro</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Nome</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>WhatsApp</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>E-mail</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Comunidade que Atua</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.cadastro || '-'}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.email || '-'}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{comunidadesAtua(s).join(', ') || '-'}</td>
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
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Nome</th>
              <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Endereço</th>
            </tr>
          </thead>
          <tbody>
            {communities.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c, i) => (
              <tr key={c.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                <td style={{ padding: '0.35rem 0.9rem', color: '#1e293b', fontWeight: 600 }}>{c.name}</td>
                <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{c.address || '-'}</td>
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
