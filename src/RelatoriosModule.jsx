import React from 'react';
import { Users, Church } from 'lucide-react';

const TIPOS = [
  { key: 'coroinha', label: 'Coroinhas' },
  { key: 'acolito', label: 'Acólitos' },
  { key: 'monitor', label: 'Monitores' },
  { key: 'cerimoniario', label: 'Cerimoniários' },
  { key: 'coordenador', label: 'Coordenadores' }
];

export function RelatoriosModule({ servers = [], communities = [] }) {
  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };

  const listaPorTipo = (tipo) => servers
    .filter(s => s.type === tipo)
    .slice()
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

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
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Cadastro</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>Nome</th>
                  <th style={{ textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' }}>WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.cadastro || '-'}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
                    <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{s.phone || '-'}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum(a) {label.toLowerCase()} cadastrado(a).</td></tr>
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
