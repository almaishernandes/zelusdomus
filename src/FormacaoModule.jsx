import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Compatibilidade: conteúdo antigo salvo como texto simples (sem tags) mantém as quebras de linha
const paraHtmlExibicao = (texto) => {
  const str = String(texto || '');
  if (/<[a-z][\s\S]*>/i.test(str)) return str;
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
};

export function FormacaoModule() {
  const [temas, setTemas] = useState({});
  const [temaId, setTemaId] = useState(null);
  const [assuntoId, setAssuntoId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    carregarFormacao();
  }, []);

  const carregarFormacao = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('formacao')
        .select('*')
        .order('tema', { ascending: true })
        .order('ordem', { ascending: true });

      if (err) throw err;

      // Agrupar por tema
      const agrupado = {};
      data?.forEach(item => {
        if (!agrupado[item.tema]) {
          agrupado[item.tema] = { itens: [] };
        }
        agrupado[item.tema].itens.push(item);
      });

      setTemas(agrupado);

      // Selecionar primeiro tema e assunto automaticamente
      const primeiroTema = Object.keys(agrupado)[0];
      if (primeiroTema) {
        setTemaId(primeiroTema);
        setAssuntoId(agrupado[primeiroTema].itens[0]?.id);
      }
    } catch (err) {
      console.error('Erro ao carregar formação:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="empty-state"><h3>Carregando formação...</h3></div>;
  }

  if (error) {
    return <div className="empty-state"><h3>Erro: {error}</h3></div>;
  }

  if (Object.keys(temas).length === 0) {
    return <div className="empty-state"><h3>Nenhum tema de formação disponível</h3></div>;
  }

  const temasArray = Object.keys(temas);
  const temaAtual = temaId && temas[temaId];
  const assuntoAtual = temaAtual?.itens.find(i => i.id === assuntoId);

  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };
  const corpoStyle = { padding: '0.9rem' };
  const selStyle = { width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.9rem', background: '#f8fafc', color: '#1e293b' };

  return (
    <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem', display: 'flex', flexDirection: 'column', maxHeight: 'none', overflow: 'visible' }}>
      <div style={secaoStyle}>
        <div style={tituloStyle}>Tema</div>
        <div style={corpoStyle}>
          <select value={temaId || ''} onChange={e => { setTemaId(e.target.value); setAssuntoId(temas[e.target.value].itens[0]?.id); }} style={selStyle}>
            {temasArray.map(tema => <option key={tema} value={tema}>{tema}</option>)}
          </select>
        </div>
      </div>

      <div style={secaoStyle}>
        <div style={tituloStyle}>Assunto</div>
        <div style={corpoStyle}>
          <select value={assuntoId || ''} onChange={e => setAssuntoId(e.target.value)} style={selStyle}>
            {temaAtual?.itens.map(item => <option key={item.id} value={item.id}>{item.assunto}</option>)}
          </select>
        </div>
      </div>

      <div style={secaoStyle}>
        <div style={tituloStyle}>Conteúdo</div>
        <div style={{ ...corpoStyle, fontFamily: '"Times New Roman", Times, serif' }}>
          {assuntoAtual ? (
            <>
              <div style={{ fontSize: '0.95rem', color: '#1e293b', lineHeight: 1.5, margin: 0, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(assuntoAtual.conteudo) }} />
              {assuntoAtual.fonte && (
                <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0.6rem 0 0', paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>Fonte: {assuntoAtual.fonte}</p>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Selecione um assunto para ver o conteúdo</div>
          )}
        </div>
      </div>
    </div>
  );
}
