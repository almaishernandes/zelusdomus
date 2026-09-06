import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { Video, MapPin, Check, X, Loader, CalendarDays } from 'lucide-react';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtData = (v) => {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(v + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${MESES[d.getMonth()]}/${d.getFullYear()}`;
  }
  return v;
};
const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export function MinhasReunioesModule() {
  const [reunioes, setReunioes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [respondendo, setRespondendo] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    // O "lock ... stole it" do supabase-auth é transitório (várias abas) —
    // tenta de novo algumas vezes antes de mostrar erro.
    let ultimoErro = null;
    for (let i = 0; i < 3; i++) {
      const { data, error } = await supabase.rpc('minhas_reunioes');
      if (!error) { setReunioes(data || []); setErro(null); setLoading(false); return; }
      ultimoErro = error;
      if (!/lock|stole/i.test(error.message)) break;
      await new Promise(r => setTimeout(r, 400));
    }
    setErro(ultimoErro?.message || 'Erro ao carregar');
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const responder = async (conviteId, status) => {
    setRespondendo(conviteId);
    const { error } = await supabase.from('reuniao_convidados')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', conviteId);
    setRespondendo(null);
    if (error) { setErro(error.message); return; }
    await carregar();
  };

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  const badge = (status) => {
    const map = {
      aceito: { bg: '#dcfce7', cor: '#166534', txt: 'Aceito' },
      recusado: { bg: '#fee2e2', cor: '#991b1b', txt: 'Recusado' },
      pendente: { bg: '#fef9c3', cor: '#854d0e', txt: 'Pendente' },
    };
    const s = map[status] || map.pendente;
    return <span style={{ background: s.bg, color: s.cor, fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 999 }}>{s.txt}</span>;
  };

  return (
    <div className="grid-container" style={{ padding: '0.9rem', display: 'grid', gap: '0.9rem' }}>
      {erro && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.9rem', borderRadius: 6 }}>{erro}</div>}

      {reunioes.length === 0 && (
        <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
          Você não tem convites para reuniões.
        </div>
      )}

      {reunioes.map((r) => (
        <div key={r.convite_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: '#1e293b', color: '#fff', padding: '0.6rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {r.tipo === 'online' ? <Video size={16} /> : <MapPin size={16} />}
            <strong style={{ fontSize: '0.9rem' }}>{r.tema}</strong>
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>— {r.assunto}</span>
            <span style={{ marginLeft: 'auto' }}>{badge(r.status)}</span>
          </div>

          <div style={{ padding: '0.9rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <CalendarDays size={14} />
              {[fmtData(r.data_reuniao), r.horario && `${r.horario}h`, r.tipo === 'presencial' && r.local].filter(Boolean).join(' — ') || 'Data a confirmar'}
            </p>

            {stripHtml(r.conteudo) && (
              <p style={{ margin: '0 0 0.7rem', fontSize: '0.82rem', color: '#475569' }}>
                <strong>Ordem do dia:</strong> {stripHtml(r.conteudo)}
              </p>
            )}

            {r.tipo === 'online' && r.status === 'aceito' && r.link_reuniao && (
              <a href={r.link_reuniao} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', textDecoration: 'none', padding: '0.5rem 0.9rem', borderRadius: 5, fontWeight: 700, fontSize: '0.85rem' }}>
                <Video size={15} /> Entrar na reunião
              </a>
            )}

            {r.tipo === 'online' && r.status !== 'aceito' && (
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                O link da sala aparece aqui depois que você aceitar o convite.
              </p>
            )}

            {r.status !== 'aceito' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                <button onClick={() => responder(r.convite_id, 'aceito')} disabled={respondendo === r.convite_id}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.45rem 0.9rem', borderRadius: 5, fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}>
                  {respondendo === r.convite_id ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />} Aceitar
                </button>
                {r.status !== 'recusado' && (
                  <button onClick={() => responder(r.convite_id, 'recusado')} disabled={respondendo === r.convite_id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.45rem 0.9rem', borderRadius: 5, fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer' }}>
                    <X size={14} /> Recusar
                  </button>
                )}
              </div>
            )}

            {r.status === 'aceito' && (
              <button onClick={() => responder(r.convite_id, 'recusado')} disabled={respondendo === r.convite_id}
                style={{ marginTop: '0.6rem', background: 'none', border: 'none', color: '#94a3b8', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}>
                Não vou mais poder participar
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
