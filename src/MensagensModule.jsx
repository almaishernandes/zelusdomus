import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Mail, X, Send } from 'lucide-react';

const fmtDataHora = (v) => v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Aviso exibido logo após o login do servidor quando existem mensagens não
// lidas endereçadas ao seu cadastro — some ao clicar (ou ao entrar na Caixa
// de Mensagens) e não volta a aparecer para mensagens já lidas.
export function AvisoMensagensNaoLidas({ numeroCadastro, onAbrirCaixa }) {
  const [qtd, setQtd] = useState(0);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    if (!numeroCadastro) return;
    let ativo = true;
    supabase.from('mensagens').select('id', { count: 'exact', head: true })
      .eq('destinatario_cadastro', numeroCadastro).eq('lida', false)
      .then(({ count }) => { if (ativo) setQtd(count || 0); });
    return () => { ativo = false; };
  }, [numeroCadastro]);

  if (!qtd || dispensado) return null;

  return (
    <div style={{ position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 2000, width: '95%', maxWidth: '420px' }}>
      <div onClick={() => { setDispensado(true); onAbrirCaixa(); }}
        style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', background: '#1e293b', color: '#fff', padding: '0.8rem 1rem', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', cursor: 'pointer' }}>
        <Mail size={20} style={{ flex: 'none', color: '#93c5fd' }} />
        <span style={{ fontSize: '0.88rem', flex: 1 }}>
          Você tem {qtd} {qtd === 1 ? 'mensagem' : 'mensagens'} na sua caixa de mensagem <strong>(clique aqui para visualizar)</strong>
        </span>
        <button onClick={(e) => { e.stopPropagation(); setDispensado(true); }}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', flex: 'none' }}><X size={16} /></button>
      </div>
    </div>
  );
}

// Caixa de Mensagens do servidor: lista tudo que já recebeu, marca como lida
// ao abrir uma mensagem ainda não lida.
export function CaixaMensagensModule({ numeroCadastro }) {
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandidaId, setExpandidaId] = useState(null);

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase.from('mensagens').select('*')
      .eq('destinatario_cadastro', numeroCadastro)
      .order('created_at', { ascending: false });
    setMensagens(data || []);
    setLoading(false);
  };

  useEffect(() => { if (numeroCadastro) carregar(); }, [numeroCadastro]);

  const abrirMensagem = async (msg) => {
    setExpandidaId(prev => prev === msg.id ? null : msg.id);
    if (!msg.lida) {
      await supabase.from('mensagens').update({ lida: true }).eq('id', msg.id);
      setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, lida: true } : m));
    }
  };

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  return (
    <div className="grid-container" style={{ padding: 0 }}>
      <div style={{ background: '#1e293b', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Mail size={16} /> Caixa de Mensagens
      </div>
      {mensagens.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma mensagem recebida.</div>
      )}
      {mensagens.map((m, i) => (
        <div key={m.id} onClick={() => abrirMensagem(m)}
          style={{ background: i % 2 === 0 ? '#ffffff' : '#f1f5f9', borderBottom: '1px solid #e2e8f0', padding: '0.6rem 0.9rem', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {!m.lida && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', flex: 'none' }} />}
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{fmtDataHora(m.created_at)}</span>
            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 700, color: m.lida ? '#94a3b8' : '#2563eb' }}>{m.lida ? 'Lida' : 'Não lida'}</span>
          </div>
          {expandidaId === m.id ? (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#1e293b', whiteSpace: 'pre-wrap' }}>{m.texto}</p>
          ) : (
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.texto}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Modal usado a partir das telas de cadastro (Coroinhas, Acólitos etc): envia
// o mesmo texto para o cadastro de cada servidor selecionado.
export function EnviarMensagemModal({ cadastros, onClose, onEnviado }) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  const handleEnviar = async () => {
    if (!texto.trim()) { setErro('Digite uma mensagem'); return; }
    setEnviando(true);
    setErro(null);
    try {
      const linhas = cadastros.map(cadastro => ({ destinatario_cadastro: cadastro, texto: texto.trim() }));
      const { error } = await supabase.from('mensagens').insert(linhas);
      if (error) throw error;
      onEnviado();
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 8, width: '95%', maxWidth: '420px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Enviar mensagem para {cadastros.length} {cadastros.length === 1 ? 'servidor' : 'servidores'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '1rem 1.2rem' }}>
          <textarea autoFocus value={texto} onChange={e => setTexto(e.target.value)}
            placeholder="Escreva a mensagem..."
            style={{ width: '100%', minHeight: '120px', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.9rem', fontFamily: 'inherit', resize: 'vertical' }} />
          {erro && <p style={{ color: '#dc2626', fontSize: '0.82rem', margin: '0.5rem 0 0' }}>{erro}</p>}
          <button onClick={handleEnviar} disabled={enviando}
            style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', width: '100%', background: '#2563eb', color: '#fff', border: 'none', padding: '0.6rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
            <Send size={14} /> {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
