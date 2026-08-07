import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Edit2, Save, Loader, AlertCircle, X, Settings, FileBarChart } from 'lucide-react';

const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '';
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function LivroCaixaModule({ setHeaderExtra }) {
  const { user } = useAuth();
  const [lancamentos, setLancamentos] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [modo, setModo] = useState(null); // null | 'novo' | 'editar'
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ emissao: '', vencimento: '', descricao: '', centro_custo_id: '', debito: '', credito: '' });

  const [gerenciarCentros, setGerenciarCentros] = useState(false);
  const [novoCentro, setNovoCentro] = useState('');
  const [editandoCentroId, setEditandoCentroId] = useState(null);
  const [nomeCentroEdit, setNomeCentroEdit] = useState('');
  const [relatorioAnual, setRelatorioAnual] = useState(false);
  const [linhaExpandidaExtrato, setLinhaExpandidaExtrato] = useState(null);

  useEffect(() => {
    carregarTudo();
  }, []);

  // Sem botões no cabeçalho do app: Custos e Anual agora ficam no corpo do
  // formulário, logo abaixo da linha "Incluir".
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(null);
  }, [setHeaderExtra]);

  const carregarTudo = async () => {
    try {
      setLoading(true);
      const [lanRes, centrosRes] = await Promise.all([
        supabase.from('livro_caixa_lancamentos').select('*').order('emissao', { ascending: true }).order('sequencia', { ascending: true }),
        supabase.from('livro_caixa_centros_custo').select('*').order('nome', { ascending: true })
      ]);
      if (lanRes.error) throw lanRes.error;
      if (centrosRes.error) throw centrosRes.error;
      setLancamentos(lanRes.data || []);
      setCentros(centrosRes.data || []);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const nomeCentro = (id) => centros.find(c => c.id === id)?.nome || 'Sem centro de custo';

  // Relatório anual: receitas e despesas por centro de custo, mês a mês, no ano em curso
  const relatorio = React.useMemo(() => {
    const anoAtual = new Date().getFullYear();
    const doAno = lancamentos.filter(l => l.emissao && new Date(l.emissao + 'T00:00:00').getFullYear() === anoAtual);

    const acumular = (campo) => {
      const porCentro = {};
      doAno.forEach(l => {
        const valor = Number(l[campo]) || 0;
        if (valor <= 0) return;
        const mes = new Date(l.emissao + 'T00:00:00').getMonth();
        const cid = l.centro_custo_id || '_sem';
        if (!porCentro[cid]) porCentro[cid] = Array(12).fill(0);
        porCentro[cid][mes] += valor;
      });
      const linhas = Object.entries(porCentro).map(([cid, meses]) => ({
        nome: nomeCentro(cid === '_sem' ? null : cid),
        meses,
        total: meses.reduce((a, b) => a + b, 0)
      })).sort((a, b) => a.nome.localeCompare(b.nome));
      const totalMeses = Array(12).fill(0);
      linhas.forEach(l => l.meses.forEach((v, i) => { totalMeses[i] += v; }));
      return { linhas, totalMeses, totalGeral: totalMeses.reduce((a, b) => a + b, 0) };
    };

    const receitas = acumular('credito');
    const despesas = acumular('debito');
    const saldoMeses = MESES_ABREV.map((_, i) => receitas.totalMeses[i] - despesas.totalMeses[i]);
    const saldoGeral = receitas.totalGeral - despesas.totalGeral;
    return { anoAtual, receitas, despesas, saldoMeses, saldoGeral };
  }, [lancamentos, centros]);

  // Saldo acumulado calculado no cliente, na ordem cronológica já retornada pela consulta
  const lancamentosComSaldo = (() => {
    let saldo = 0;
    return lancamentos.map(l => {
      saldo += (Number(l.credito) || 0) - (Number(l.debito) || 0);
      return { ...l, saldoAcumulado: saldo };
    });
  })();

  const abrirInserir = () => {
    setModo('novo');
    setEditandoId(null);
    setForm({ emissao: new Date().toISOString().slice(0, 10), vencimento: '', descricao: '', centro_custo_id: '', debito: '', credito: '' });
  };

  const abrirEdicao = (item) => {
    setModo('editar');
    setEditandoId(item.id);
    setForm({
      emissao: item.emissao || '',
      vencimento: item.vencimento || '',
      descricao: item.descricao || '',
      centro_custo_id: item.centro_custo_id || '',
      debito: item.debito ? String(item.debito) : '',
      credito: item.credito ? String(item.credito) : ''
    });
  };

  const cancelarForm = () => {
    setModo(null);
    setEditandoId(null);
    setForm({ emissao: '', vencimento: '', descricao: '', centro_custo_id: '', debito: '', credito: '' });
  };

  const handleSalvar = async () => {
    if (!form.emissao || !form.descricao.trim()) {
      setError('Preencha ao menos Emissão e Descrição');
      return;
    }
    if (Number(form.debito) > 0 && Number(form.credito) > 0) {
      setError('Preencha apenas Débito ou apenas Crédito, não os dois');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        emissao: form.emissao,
        vencimento: form.vencimento || null,
        descricao: form.descricao.trim(),
        centro_custo_id: form.centro_custo_id || null,
        debito: Number(form.debito) || 0,
        credito: Number(form.credito) || 0
      };

      if (editandoId) {
        const { error: err } = await supabase.from('livro_caixa_lancamentos')
          .update({ ...payload, updated_at: new Date() })
          .eq('id', editandoId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('livro_caixa_lancamentos')
          .insert({ ...payload, created_by: user.id });
        if (err) throw err;
      }

      cancelarForm();
      await carregarTudo();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que quer excluir este lançamento?')) return;
    try {
      const { error: err } = await supabase.from('livro_caixa_lancamentos').delete().eq('id', id);
      if (err) throw err;
      await carregarTudo();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdicionarCentro = async () => {
    if (!novoCentro.trim()) return;
    try {
      const { error: err } = await supabase.from('livro_caixa_centros_custo').insert({ nome: novoCentro.trim(), created_by: user.id });
      if (err) throw err;
      setNovoCentro('');
      await carregarTudo();
    } catch (err) {
      setError(err.message);
    }
  };

  const abrirEdicaoCentro = (c) => {
    setEditandoCentroId(c.id);
    setNomeCentroEdit(c.nome);
  };

  const cancelarEdicaoCentro = () => {
    setEditandoCentroId(null);
    setNomeCentroEdit('');
  };

  const handleSalvarEdicaoCentro = async () => {
    if (!nomeCentroEdit.trim()) return;
    try {
      const { error: err } = await supabase.from('livro_caixa_centros_custo')
        .update({ nome: nomeCentroEdit.trim() }).eq('id', editandoCentroId);
      if (err) throw err;
      cancelarEdicaoCentro();
      await carregarTudo();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExcluirCentro = async (id) => {
    if (!window.confirm('Excluir este centro de custo?')) return;
    try {
      const { error: err } = await supabase.from('livro_caixa_centros_custo').delete().eq('id', id);
      if (err) throw err;
      await carregarTudo();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '0.25rem 0.4rem', borderRadius: 3, cursor: 'pointer', display: 'inline-flex' });
  const inputStyle = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' };
  const saldoFinal = lancamentosComSaldo.length > 0 ? lancamentosComSaldo[lancamentosComSaldo.length - 1].saldoAcumulado : 0;

  return (
    <div className="grid-container" style={{ padding: 0, display: 'flex', justifyContent: 'center' }}>
    <div style={{ width: '100%', maxWidth: '430px' }}>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <AlertCircle size={16} style={{ flex: 'none' }} />
          <span style={{ fontSize: '0.85rem' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><X size={14} /></button>
        </div>
      )}

      {/* ---- Incluir + Custos/Anual, logo abaixo ---- */}
      <button onClick={abrirInserir}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#1e293b', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
        <Plus size={14} /> Incluir
      </button>
      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem 0.6rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <button type="button" onClick={() => setGerenciarCentros(true)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
          <Settings size={14} /> Custos
        </button>
        <button type="button" onClick={() => setRelatorioAnual(true)}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.4rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
          <FileBarChart size={14} /> Anual
        </button>
      </div>

      {/* ---- Formulário de inclusão/edição: só aparece ao clicar em Incluir ---- */}
      {modo && (
        <div style={{ background: '#f1f5f9', borderTop: '3px solid #1e293b', padding: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.7rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Emissão</label>
              <input type="date" value={form.emissao} onChange={e => setForm({ ...form, emissao: e.target.value, vencimento: e.target.value })} style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Vencimento</label>
              <input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Descrição</label>
              <input type="text" placeholder="Descrição do lançamento" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Centro de Custo</label>
              <select value={form.centro_custo_id} onChange={e => setForm({ ...form, centro_custo_id: e.target.value })} style={inputStyle}>
                <option value="">Selecione...</option>
                {centros.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Débito</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={form.debito} onChange={e => setForm({ ...form, debito: e.target.value, credito: e.target.value ? '' : form.credito })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Crédito</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={form.credito} onChange={e => setForm({ ...form, credito: e.target.value, debito: e.target.value ? '' : form.debito })} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={handleSalvar} disabled={salvando}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              {salvando ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Salvar
            </button>
            <button onClick={cancelarForm}
              style={{ background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ---- Extrato: exibido sempre que o formulário não está aberto ---- */}
      {!modo && (
        <div>
          <div style={{ display: 'flex', padding: '0.4rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
            <span style={{ flex: 1, textAlign: 'left' }}>Data</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Débito</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Crédito</span>
            <span style={{ flex: 1, textAlign: 'right' }}>Saldo</span>
          </div>
          {lancamentosComSaldo.map((item, i) => (
            <div key={item.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
              <div onClick={() => setLinhaExpandidaExtrato(prev => prev === item.id ? null : item.id)}
                style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.6rem', cursor: 'pointer', fontSize: '0.82rem' }}>
                <span style={{ flex: 1, textAlign: 'left', color: '#334155' }}>{fmtData(item.emissao)}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#dc2626' }}>{item.debito ? fmtMoeda(item.debito) : ''}</span>
                <span style={{ flex: 1, textAlign: 'right', color: '#16a34a' }}>{item.credito ? fmtMoeda(item.credito) : ''}</span>
                <span style={{ flex: 1, textAlign: 'right', fontWeight: 700, color: item.saldoAcumulado < 0 ? '#dc2626' : '#1e293b' }}>{fmtMoeda(item.saldoAcumulado)}</span>
              </div>
              {linhaExpandidaExtrato === item.id && (
                <div style={{ padding: '0 0.6rem 0.5rem 0.6rem', fontSize: '0.78rem', color: '#64748b' }}>
                  <div>{item.descricao}</div>
                  <div style={{ marginBottom: '0.4rem' }}>{nomeCentro(item.centro_custo_id)}</div>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <button onClick={(e) => { e.stopPropagation(); abrirEdicao(item); }} title="Editar" style={btn('#3b82f6')}><Edit2 size={13} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleExcluir(item.id); }} title="Excluir" style={btn('#dc2626')}><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {lancamentos.length === 0 && (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhum lançamento cadastrado. Toque em "Incluir" para começar.</div>
          )}
          {lancamentos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.6rem', borderTop: '2px solid #1e293b', fontWeight: 700 }}>
              <span>Saldo Final</span>
              <span style={{ color: saldoFinal < 0 ? '#dc2626' : '#1e293b' }}>{fmtMoeda(saldoFinal)}</span>
            </div>
          )}
        </div>
      )}

      {/* ---- Modal: gerenciar Centros de Custo ---- */}
      {gerenciarCentros && (
        <div onClick={() => setGerenciarCentros(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Centros de Custo</span>
              <button onClick={() => setGerenciarCentros(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1rem 1.2rem', overflowY: 'auto' }}>
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.9rem' }}>
                <input type="text" placeholder="Novo centro de custo" value={novoCentro}
                  onChange={e => setNovoCentro(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdicionarCentro()}
                  style={inputStyle} />
                <button onClick={handleAdicionarCentro}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', flex: 'none' }}>
                  <Plus size={14} />
                </button>
              </div>
              {centros.map((c, i) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', padding: '0.4rem 0.6rem', background: i % 2 === 0 ? '#ffffff' : '#f1f5f9', borderRadius: 4 }}>
                  {editandoCentroId === c.id ? (
                    <>
                      <input type="text" autoFocus value={nomeCentroEdit}
                        onChange={e => setNomeCentroEdit(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSalvarEdicaoCentro()}
                        style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={handleSalvarEdicaoCentro} title="Salvar" style={btn('#16a34a')}><Save size={13} /></button>
                      <button onClick={cancelarEdicaoCentro} title="Cancelar" style={btn('#94a3b8')}><X size={13} /></button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '0.85rem', color: '#334155' }}>{c.nome}</span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button onClick={() => abrirEdicaoCentro(c)} title="Editar" style={btn('#3b82f6')}><Edit2 size={13} /></button>
                        <button onClick={() => handleExcluirCentro(c.id)} title="Excluir" style={btn('#dc2626')}><Trash2 size={13} /></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {centros.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Nenhum centro de custo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal: Relatório Anual de Receitas e Despesas ---- */}
      {relatorioAnual && (() => {
        const celMes = { padding: '0.3rem 0.4rem', textAlign: 'right', whiteSpace: 'nowrap' };
        const linhaSecao = (titulo) => (
          <tr>
            <td colSpan={14} style={{ padding: '0.4rem 0.5rem', background: '#1e293b', color: '#fff', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase' }}>{titulo}</td>
          </tr>
        );
        const linhaCentro = (l, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
            <td style={{ padding: '0.3rem 0.5rem', color: '#334155' }}>{l.nome}</td>
            {l.meses.map((v, m) => <td key={m} style={celMes}>{v ? fmtMoeda(v) : ''}</td>)}
            <td style={{ ...celMes, fontWeight: 700 }}>{fmtMoeda(l.total)}</td>
          </tr>
        );
        const linhaTotal = (label, totalMeses, totalGeral, cor) => (
          <tr style={{ background: '#e2e8f0', fontWeight: 800, color: cor }}>
            <td style={{ padding: '0.35rem 0.5rem' }}>{label}</td>
            {totalMeses.map((v, m) => <td key={m} style={celMes}>{fmtMoeda(v)}</td>)}
            <td style={celMes}>{fmtMoeda(totalGeral)}</td>
          </tr>
        );
        return (
          <div onClick={() => setRelatorioAnual(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 8, width: '95%', maxWidth: '1200px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Relatório Anual de Receitas e Despesas — {relatorio.anoAtual}</span>
                <button onClick={() => setRelatorioAnual(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
              </div>
              <div style={{ padding: '1rem 1.2rem', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.3rem 0.5rem', textAlign: 'left', borderBottom: '2px solid #1e293b' }}>Centro de Custo</th>
                      {MESES_ABREV.map(m => <th key={m} style={{ ...celMes, borderBottom: '2px solid #1e293b' }}>{m}</th>)}
                      <th style={{ ...celMes, borderBottom: '2px solid #1e293b' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhaSecao('Receitas')}
                    {relatorio.receitas.linhas.length === 0 ? (
                      <tr><td colSpan={14} style={{ padding: '0.5rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma receita no ano.</td></tr>
                    ) : relatorio.receitas.linhas.map(linhaCentro)}
                    {linhaTotal('Total Receitas', relatorio.receitas.totalMeses, relatorio.receitas.totalGeral, '#16a34a')}

                    {linhaSecao('Despesas')}
                    {relatorio.despesas.linhas.length === 0 ? (
                      <tr><td colSpan={14} style={{ padding: '0.5rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma despesa no ano.</td></tr>
                    ) : relatorio.despesas.linhas.map(linhaCentro)}
                    {linhaTotal('Total Despesas', relatorio.despesas.totalMeses, relatorio.despesas.totalGeral, '#dc2626')}

                    {linhaTotal('Saldo do Período', relatorio.saldoMeses, relatorio.saldoGeral, relatorio.saldoGeral < 0 ? '#dc2626' : '#1e293b')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
    </div>
  );
}
