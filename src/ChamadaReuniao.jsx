import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Video, PhoneOff, Loader } from 'lucide-react';

// Toque simples via WebAudio — sem arquivo de áudio (CSP do Hostinger).
function useRingtone() {
  const ctxRef = useRef(null);
  const stopRef = useRef(null);

  const start = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = ctxRef.current || new Ctx();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') ctx.resume();
      let parar = false;
      const bip = () => {
        if (parar) return;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.55);
      };
      bip();
      const iv = setInterval(bip, 1400);
      stopRef.current = () => { parar = true; clearInterval(iv); };
    } catch { /* áudio bloqueado */ }
  }, []);

  const stop = useCallback(() => { stopRef.current?.(); stopRef.current = null; }, []);
  useEffect(() => () => stop(), [stop]);
  return { start, stop };
}

export function ChamadaReuniao() {
  const { perfil, eAutenticado } = useAuth();
  const cadastro = perfil?.numero_cadastro;
  const [chamada, setChamada] = useState(null); // { reuniaoId, conviteId, tema }
  const [entrando, setEntrando] = useState(false);
  const minhas = useRef(new Map());  // reuniaoId -> { conviteId, tema }
  const vistas = useRef(new Set());  // chamada_em já tratadas
  const { start, stop } = useRingtone();

  const recarregarMinhas = useCallback(async () => {
    if (!cadastro) return;
    const { data } = await supabase.rpc('minhas_reunioes');
    minhas.current = new Map(
      (data || []).filter(r => r.tipo === 'online').map(r => [r.id, { conviteId: r.convite_id, tema: r.tema, assunto: r.assunto }])
    );
  }, [cadastro]);

  useEffect(() => {
    if (!eAutenticado || !cadastro) return;
    recarregarMinhas();

    const canal = supabase
      .channel('chamadas-reuniao')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'atas_reuniao' }, (payload) => {
        const row = payload.new;
        if (!row?.chamada_em) return;
        const info = minhas.current.get(row.id);
        if (!info) return;
        const idade = Date.now() - new Date(row.chamada_em).getTime();
        if (idade > 120000) return;              // chamada velha, ignora
        const chave = `${row.id}|${row.chamada_em}`;
        if (vistas.current.has(chave)) return;
        vistas.current.add(chave);
        setChamada({ reuniaoId: row.id, conviteId: info.conviteId, tema: info.tema, assunto: info.assunto });
      })
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, [eAutenticado, cadastro, recarregarMinhas]);

  useEffect(() => {
    if (chamada) start(); else stop();
  }, [chamada, start, stop]);

  const entrar = async () => {
    setEntrando(true);
    const { data: link, error } = await supabase.rpc('entrar_na_reuniao', { p_convite_id: chamada.conviteId });
    setEntrando(false);
    stop();
    if (!error && link) window.open(link, '_blank', 'noopener');
    setChamada(null);
  };

  const recusar = () => { stop(); setChamada(null); };

  if (!chamada) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.92)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ background: '#fff', borderRadius: 16, maxWidth: 420, width: '100%', textAlign: 'center', padding: '2rem 1.6rem' }}>
        <div style={{ width: 76, height: 76, margin: '0 auto 1.1rem', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'spin 2s linear infinite' }}>
          <Video size={34} color="#16a34a" />
        </div>
        <p style={{ margin: '0 0 0.3rem', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#16a34a' }}>Chamada de reunião</p>
        <h2 style={{ margin: '0 0 0.3rem', fontSize: '1.3rem', color: '#1e293b' }}>{chamada.tema}</h2>
        {chamada.assunto && <p style={{ margin: '0 0 1.4rem', color: '#64748b', fontSize: '0.9rem' }}>{chamada.assunto}</p>}
        <p style={{ margin: '0 0 1.4rem', color: '#475569', fontSize: '0.9rem' }}>O coordenador está chamando você para entrar agora.</p>
        <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center' }}>
          <button onClick={recusar}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e2e8f0', color: '#334155', border: 'none', padding: '0.7rem 1.2rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            <PhoneOff size={16} /> Agora não
          </button>
          <button onClick={entrar} disabled={entrando}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.7rem 1.4rem', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
            {entrando ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={16} />} Entrar
          </button>
        </div>
      </div>
    </div>
  );
}
