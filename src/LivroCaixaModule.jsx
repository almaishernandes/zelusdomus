import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Edit2, Save, Loader, AlertCircle, X, Settings } from 'lucide-react';

const fmtMoeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (v) => v ? new Date(v + 'T00:00:00').toLocaleDateString('pt-BR') : '';

export function LivroCaixaModule() {
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

  useEffect(() => {
    carregarTudo();
  }, []);

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

  const nomeCentro = (id) => centros.find(c => c.id === id)?.nome || '-';

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
    <div className="grid-container" style={{ padding: 0 }}>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <AlertCircle size={16} style={{ flex: 'none' }} />
          <span style={{ fontSize: '0.85rem' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><X size={14} /></button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr>
            <th style={{ background: '#1e293b', padding: 0, textAlign: 'left', width: '160px' }}>
              <button onClick={abrirInserir}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                <Plus size={14} /> Inserir Lançamento
              </button>
            </th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Emissão</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Vencimento</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Descrição</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'left', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Centro de Custo</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Débito</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Crédito</th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.5rem', textAlign: 'right', color: '#fff', fontWeight: 700, fontSize: '0.78rem' }}>Saldo</th>
            <th style={{ background: '#1e293b', width: '90px', padding: 0 }}>
              <button onClick={() => setGerenciarCentros(true)} title="Gerenciar Centros de Custo"
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.5rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>
                <Settings size={13} />
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {lancamentosComSaldo.map((item, i) => (
            <tr key={item.id} style={{ background: i % 2 === 0 ? '#ffffff' : '#f1f5f9' }}>
              <td style={{ padding: '0.35rem 0.9rem', color: '#64748b' }}>{item.sequencia}</td>
              <td style={{ padding: '0.35rem 0.5rem', color: '#334155' }}>{fmtData(item.emissao)}</td>
              <td style={{ padding: '0.35rem 0.5rem', color: '#334155' }}>{fmtData(item.vencimento)}</td>
              <td style={{ padding: '0.35rem 0.5rem', color: '#334155' }}>{item.descricao}</td>
              <td style={{ padding: '0.35rem 0.5rem', color: '#64748b' }}>{nomeCentro(item.centro_custo_id)}</td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: '#dc2626' }}>{item.debito ? fmtMoeda(item.debito) : ''}</td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', color: '#16a34a' }}>{item.credito ? fmtMoeda(item.credito) : ''}</td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: 700, color: item.saldoAcumulado < 0 ? '#dc2626' : '#1e293b' }}>{fmtMoeda(item.saldoAcumulado)}</td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                  <button onClick={() => abrirEdicao(item)} title="Editar" style={btn('#3b82f6')}><Edit2 size={13} /></button>
                  <button onClick={() => handleExcluir(item.id)} title="Excluir" style={btn('#dc2626')}><Trash2 size={13} /></button>
                </div>
              </td>
            </tr>
          ))}

          {lancamentos.length === 0 && (
            <tr><td colSpan={9} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum lançamento cadastrado. Clique em "Inserir Lançamento" para começar.</td></tr>
          )}
        </tbody>
        {lancamentos.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={7} style={{ padding: '0.5rem 0.9rem', textAlign: 'right', fontWeight: 700, color: '#1e293b', borderTop: '2px solid #1e293b' }}>Saldo Final</td>
              <td style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 800, color: saldoFinal < 0 ? '#dc2626' : '#1e293b', borderTop: '2px solid #1e293b' }}>{fmtMoeda(saldoFinal)}</td>
              <td style={{ borderTop: '2px solid #1e293b' }}></td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* ---- Segunda folha: formulário de inclusão/edição ---- */}
      {modo && (
        <div style={{ background: '#f1f5f9', borderTop: '3px solid #1e293b', padding: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr 1.4fr 1fr 1fr', gap: '0.6rem', marginBottom: '0.7rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Emissão</label>
              <input type="date" value={form.emissao} onChange={e => setForm({ ...form, emissao: e.target.value })} style={inputStyle} autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Vencimento</label>
              <input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Descrição</label>
              <input type="text" placeholder="Descrição do lançamento" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} style={inputStyle} />
            </div>
            <div>
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
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.6rem', background: i % 2 === 0 ? '#ffffff' : '#f1f5f9', borderRadius: 4 }}>
                  <span style={{ fontSize: '0.85rem', color: '#334155' }}>{c.nome}</span>
                  <button onClick={() => handleExcluirCentro(c.id)} style={btn('#dc2626')}><Trash2 size={13} /></button>
                </div>
              ))}
              {centros.length === 0 && (
                <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center' }}>Nenhum centro de custo cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
