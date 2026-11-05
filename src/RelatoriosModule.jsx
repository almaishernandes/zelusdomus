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

const DOW_ORDER = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

// Resume o mass_schedules da comunidade (evento -> { horarios: {DOW: "HH:MM"} }) em texto legível
const horariosMissa = (ms) => {
  if (!ms || Array.isArray(ms) || typeof ms !== 'object') return '-';
  const blocos = Object.entries(ms).map(([evento, schedule]) => {
    const horarios = schedule?.horarios || schedule || {};
    const partes = [];
    DOW_ORDER.forEach(dow => {
      const raw = horarios[dow];
      if (!raw) return;
      String(raw).split(',').map(t => t.trim().replace(';', ':')).filter(Boolean).forEach(hora => partes.push(`${dow} ${hora}`));
    });
    return partes.length ? `${evento}: ${partes.join(', ')}` : null;
  }).filter(Boolean);
  return blocos.length ? blocos.join(' | ') : '-';
};

// Ordena por número de cadastro (numérico quando possível, senão texto)
const porCadastro = (a, b) => {
  const na = parseInt(a.cadastro, 10), nb = parseInt(b.cadastro, 10);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a.cadastro || '').localeCompare(String(b.cadastro || ''));
};

const th = { textAlign: 'left', padding: '0.4rem 0.9rem', color: '#64748b', fontSize: '0.75rem' };
const td = { padding: '0.35rem 0.9rem', color: '#64748b' };

export function RelatoriosModule({ servers = [], communities = [], setHeaderExtra, isMobile }) {
  const [visao, setVisao] = useState('porFuncao'); // 'porFuncao' | 'servidores' | 'aniversariantes'
  const [ordemServidores, setOrdemServidores] = useState('cadastro'); // 'cadastro' | 'nome'
  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };

  const OPCOES_VISAO = [
    { key: 'aniversariantes', label: 'Aniversariantes', icon: Cake },
    { key: 'servidores', label: 'Relação Servidores', icon: Users },
    { key: 'porFuncao', label: 'Relação por Função', icon: ClipboardList },
    { key: 'comunidades', label: 'Comunidades', icon: Church },
  ];

  // Desktop: botões de relatório injetados na 1ª linha do cabeçalho do app, ao
  // lado de Sair. No mobile isso iria para dentro da barra de "Voltar" da
  // aba de Relatórios e ficaria apertado — lá usamos abas próprias (abaixo).
  useEffect(() => {
    if (!setHeaderExtra || isMobile) return;
    const btn = (ativo) => ({
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      background: ativo ? '#0f766e' : '#94a3b8', color: '#fff', border: 'none',
      padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700
    });
    setHeaderExtra(
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {OPCOES_VISAO.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" onClick={() => setVisao(key)} style={btn(visao === key)}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
    );
    return () => setHeaderExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderExtra, visao, isMobile]);

  const abasMobile = isMobile && (
    <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', padding: '0.8rem 0.8rem 0' }}>
      {OPCOES_VISAO.map(({ key, label, icon: Icon }) => (
        <button key={key} type="button" onClick={() => setVisao(key)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flex: 'none', background: visao === key ? '#0f766e' : '#f1f5f9', color: visao === key ? '#fff' : '#334155', border: 'none', borderRadius: 16, padding: '0.4rem 0.8rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );

  // Linhas de tabela viram cards empilhados no celular — mesmos dados, um
  // card por pessoa/comunidade em vez de colunas que cortam na tela.
  const CardLinha = ({ titulo, subtitulo, campos }) => (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem 0.9rem', marginBottom: '0.5rem' }}>
      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.88rem' }}>{titulo}</div>
      {subtitulo && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{subtitulo}</div>}
      <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem', color: '#475569' }}>
        {campos.filter(([, v]) => v).map(([k, v]) => <div key={k}><strong>{k}:</strong> {v}</div>)}
      </div>
    </div>
  );

  const listaPorTipo = (tipo) => servers
    .filter(s => s.type === tipo)
    .slice()
    .sort(porCadastro);

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

  const mesAtual = new Date().getMonth();
  const mesSeguinte = (mesAtual + 1) % 12;
  const aniversariantesDoMes = (mes) => servidoresUnicos
    .filter(s => s.dob && new Date(s.dob + 'T00:00:00').getMonth() === mes)
    .sort((a, b) => new Date(a.dob + 'T00:00:00').getDate() - new Date(b.dob + 'T00:00:00').getDate());

  const todosServidoresOrdenados = servers.slice().sort(
    ordemServidores === 'nome'
      ? (a, b) => (a.full_name || '').localeCompare(b.full_name || '')
      : porCadastro
  );

  const tabelaAniversariantes = (mes, lista) => (
    <div key={mes} style={secaoStyle}>
      <div style={tituloStyle}><Cake size={15} /> {MESES[mes]} ({lista.length})</div>
      {isMobile ? (
        <div style={{ padding: '0.6rem' }}>
          {lista.map(s => (
            <CardLinha key={s.person_id || s.id} titulo={s.full_name} subtitulo={`Cadastro ${s.cadastro || '-'} — ${TYPE_LABEL[s.type] || s.type}`}
              campos={[['Aniversário', `${fmtDataCurta(s.dob)} (${calcIdade(s.dob)} anos)`], ['WhatsApp', s.phone], ['E-mail', s.email], ['Comunidade', comunidadesAtua(s).join(', ')]]} />
          ))}
          {lista.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '0.9rem' }}>Nenhum aniversariante em {MESES[mes]}.</p>}
        </div>
      ) : (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={th}>Cadastro</th>
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
          {lista.map((s, i) => (
            <tr key={s.person_id || s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={td}>{s.cadastro || '-'}</td>
              <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{s.full_name}</td>
              <td style={td}>{TYPE_LABEL[s.type] || s.type}</td>
              <td style={td}>{fmtDataCurta(s.dob)}</td>
              <td style={td}>{calcIdade(s.dob)}</td>
              <td style={td}>{s.phone || '-'}</td>
              <td style={td}>{s.email || '-'}</td>
              <td style={td}>{comunidadesAtua(s).join(', ') || '-'}</td>
            </tr>
          ))}
          {lista.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum aniversariante em {MESES[mes]}.</td></tr>
          )}
        </tbody>
      </table>
      )}
    </div>
  );

  if (visao === 'aniversariantes') {
    return (
      <div className="grid-container" style={{ padding: isMobile ? '0 0 1rem' : '1rem 1.2rem 2rem' }}>
        {abasMobile}
        <div style={isMobile ? { padding: '0.8rem' } : undefined}>
          {tabelaAniversariantes(mesAtual, aniversariantesDoMes(mesAtual))}
          {tabelaAniversariantes(mesSeguinte, aniversariantesDoMes(mesSeguinte))}
        </div>
      </div>
    );
  }

  if (visao === 'servidores') {
    return (
      <div className="grid-container" style={{ padding: isMobile ? '0 0 1rem' : '1rem 1.2rem 2rem' }}>
        {abasMobile}
        <div style={isMobile ? { padding: '0.8rem' } : undefined}>
        <div style={secaoStyle}>
          <div style={{ ...tituloStyle, gap: '0.8rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button type="button" onClick={() => setOrdemServidores('cadastro')}
                style={{ background: ordemServidores === 'cadastro' ? '#fff' : 'rgba(255,255,255,0.5)', color: '#000', border: 'none', borderRadius: 4, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                Ordenar por Cadastro
              </button>
              <button type="button" onClick={() => setOrdemServidores('nome')}
                style={{ background: ordemServidores === 'nome' ? '#fff' : 'rgba(255,255,255,0.5)', color: '#000', border: 'none', borderRadius: 4, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}>
                Ordenar por Nome
              </button>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Users size={15} /> Relação de Servidores ({todosServidoresOrdenados.length})</span>
          </div>
          {isMobile ? (
            <div style={{ padding: '0.6rem' }}>
              {todosServidoresOrdenados.map(s => (
                <CardLinha key={s.id} titulo={s.full_name} subtitulo={`Cadastro ${s.cadastro || '-'} — ${TYPE_LABEL[s.type] || s.type}`}
                  campos={[['WhatsApp', s.phone], ['E-mail', s.email], ['Comunidade', comunidadesAtua(s).join(', ')]]} />
              ))}
              {todosServidoresOrdenados.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '0.9rem' }}>Nenhum servidor cadastrado.</p>}
            </div>
          ) : (
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
          )}
        </div>
        </div>
      </div>
    );
  }

  if (visao === 'comunidades') {
    return (
      <div className="grid-container" style={{ padding: isMobile ? '0 0 1rem' : '1rem 1.2rem 2rem' }}>
        {abasMobile}
        <div style={isMobile ? { padding: '0.8rem' } : undefined}>
        <div style={secaoStyle}>
          <div style={tituloStyle}><Church size={15} /> Comunidades ({communities.length})</div>
          {isMobile ? (
            <div style={{ padding: '0.6rem' }}>
              {communities.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => (
                <CardLinha key={c.id} titulo={c.name} campos={[['Horário de Missa', horariosMissa(c.mass_schedules)]]} />
              ))}
              {communities.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '0.9rem' }}>Nenhuma comunidade cadastrada.</p>}
            </div>
          ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={th}>Nome</th>
                <th style={th}>Horário de Missa</th>
              </tr>
            </thead>
            <tbody>
              {communities.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((c, i) => (
                <tr key={c.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                  <td style={{ ...td, color: '#1e293b', fontWeight: 600 }}>{c.name}</td>
                  <td style={td}>{horariosMissa(c.mass_schedules)}</td>
                </tr>
              ))}
              {communities.length === 0 && (
                <tr><td colSpan={2} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma comunidade cadastrada.</td></tr>
              )}
            </tbody>
          </table>
          )}
        </div>
        </div>
      </div>
    );
  }

  // Larguras fixas e iguais em todas as seções, para as colunas alinharem
  // na mesma posição de uma função para outra.
  const colsPorFuncao = ['12%', '30%', '16%', '20%', '22%'];
  const thFixo = (w) => ({ ...th, width: w });

  return (
    <div className="grid-container" style={{ padding: isMobile ? '0 0 1rem' : '1rem 1.2rem 2rem' }}>
      {abasMobile}
      <div style={isMobile ? { padding: '0.8rem' } : undefined}>
      {TIPOS.map(({ key, label }) => {
        const lista = listaPorTipo(key);
        return (
          <div key={key} style={secaoStyle}>
            <div style={tituloStyle}><Users size={15} /> {label} ({lista.length})</div>
            {isMobile ? (
              <div style={{ padding: '0.6rem' }}>
                {lista.map(s => (
                  <CardLinha key={s.id} titulo={s.full_name} subtitulo={`Cadastro ${s.cadastro || '-'}`}
                    campos={[['WhatsApp', s.phone], ['E-mail', s.email], ['Comunidade', comunidadesAtua(s).join(', ')]]} />
                ))}
                {lista.length === 0 && <p style={{ textAlign: 'center', color: '#94a3b8', padding: '0.9rem' }}>Nenhum(a) {label.toLowerCase()} cadastrado(a).</p>}
              </div>
            ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={thFixo(colsPorFuncao[0])}>Cadastro</th>
                  <th style={thFixo(colsPorFuncao[1])}>Nome</th>
                  <th style={thFixo(colsPorFuncao[2])}>WhatsApp</th>
                  <th style={thFixo(colsPorFuncao[3])}>E-mail</th>
                  <th style={thFixo(colsPorFuncao[4])}>Comunidade que Atua</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cadastro || '-'}</td>
                    <td style={{ ...td, color: '#1e293b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.phone || '-'}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email || '-'}</td>
                    <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comunidadesAtua(s).join(', ') || '-'}</td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: '0.9rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum(a) {label.toLowerCase()} cadastrado(a).</td></tr>
                )}
              </tbody>
            </table>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
