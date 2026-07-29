import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Edit2, Save, X, AlertCircle, Loader, Eye, MessageCircle, Printer, BookOpen, Image as ImageIcon, Bold, Underline, Italic } from 'lucide-react';

const loadHtml2pdf = () => import('html2pdf.js').then(m => m.default);

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Compatibilidade: conteúdo antigo salvo como texto simples (sem tags) mantém as quebras de linha
const paraHtmlExibicao = (texto) => {
  const str = String(texto || '');
  if (/<[a-z][\s\S]*>/i.test(str)) return str;
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
};

// Bloco de anotações com formatação básica (negrito, sublinhado, itálico, tamanho da letra)
function ConteudoEditor({ value, onChange, autoFocus }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = value || '';
    if (autoFocus && ref.current) ref.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd, val) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML || '');
  };

  const toolbarBtn = { background: '#fff', border: '1px solid #cbd5e1', borderRadius: 3, padding: '0.3rem 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' };

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
        <button type="button" title="Negrito" onMouseDown={e => e.preventDefault()} onClick={() => exec('bold')} style={toolbarBtn}><Bold size={14} /></button>
        <button type="button" title="Sublinhado" onMouseDown={e => e.preventDefault()} onClick={() => exec('underline')} style={toolbarBtn}><Underline size={14} /></button>
        <button type="button" title="Itálico" onMouseDown={e => e.preventDefault()} onClick={() => exec('italic')} style={toolbarBtn}><Italic size={14} /></button>
        <select title="Tamanho da letra" defaultValue="3" onMouseDown={e => e.stopPropagation()}
          onChange={e => exec('fontSize', e.target.value)} style={{ ...toolbarBtn, cursor: 'pointer' }}>
          <option value="2">Pequena</option>
          <option value="3">Normal</option>
          <option value="5">Grande</option>
          <option value="7">Muito Grande</option>
        </select>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML || '')}
        style={{ width: '100%', minHeight: '280px', padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.9rem', lineHeight: 1.5, background: '#fff', overflowY: 'auto' }}
      />
    </div>
  );
}

export function FormacaoAdminModule() {
  const { user, perfil } = useAuth();
  const [formacao, setFormacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState(null);
  const [gerandoLivro, setGerandoLivro] = useState(false);

  const [selecionado, setSelecionado] = useState(null); // { tema, assunto }
  const [itemVisualizando, setItemVisualizando] = useState(null);
  const [livroVisualizando, setLivroVisualizando] = useState(null); // array de temas com seus itens
  const [temasEscolhidos, setTemasEscolhidos] = useState(() => new Set());
  const [livroMeta, setLivroMeta] = useState(null); // capa, folha de rosto, dedicatória etc. (editáveis)
  const itemPreviewRef = useRef(null);
  const livroPreviewRef = useRef(null);

  // Ao abrir cada modal, garante que a visualização comece do topo do documento
  useEffect(() => {
    if (itemVisualizando && itemPreviewRef.current) itemPreviewRef.current.scrollTop = 0;
  }, [itemVisualizando]);

  useEffect(() => {
    if (livroVisualizando && livroPreviewRef.current) livroPreviewRef.current.scrollTop = 0;
  }, [livroVisualizando]);

  const livroMetaPadrao = () => ({
    subtitulo: 'Manual de Formação para Servidores do Altar',
    autor: (perfil?.full_name) || 'Coordenação de Servidores do Altar',
    ano: String(new Date().getFullYear()),
    folhaRostoTexto: 'Livro de formação e estudo destinado a coroinhas, acólitos, cerimoniários e demais servidores do altar, organizado para apoiar a formação litúrgica e espiritual.',
    dedicatoria: 'A todos os servidores do altar que, com dedicação e reverência, servem à liturgia e ao povo de Deus.',
    agradecimentos: 'Agradecemos a todos os coordenadores, formadores e servidores que colaboraram na organização e revisão deste material de formação.',
    epigrafe: '"Servi ao Senhor com alegria."',
    epigrafeFonte: '(Salmo 100, 2)',
    resumo: '',
    palavrasChave: 'Liturgia. Servidores do Altar. Formação. Coroinhas. Acólitos.',
    capaImagem: null,
    capaFinalImagem: null,
    capaFinalTexto: ''
  });

  // modo: null | 'tema' | 'assunto' | 'conteudo' | 'editar'
  const [modo, setModo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ tema: '', assunto: '', conteudo: '', fonte: '' });

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
      setFormacao(data || []);
    } catch (err) {
      console.error('Erro ao carregar:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const primeirasPalavras = (texto, n = 10) => {
    const palavras = stripHtml(texto).split(/\s+/).filter(Boolean);
    if (palavras.length <= n) return palavras.join(' ');
    return palavras.slice(0, n).join(' ') + '…';
  };

  // ---- Abrir formulário (segunda folha, abaixo de todos os temas) ----
  const abrirInserirTema = () => {
    setModo('tema');
    setEditandoId(null);
    setForm({ tema: '', assunto: '', conteudo: '', fonte: '' });
  };

  const abrirInserirAssunto = () => {
    if (!selecionado) { setError('Selecione um tema na lista antes de inserir um assunto'); return; }
    setModo('assunto');
    setEditandoId(null);
    setForm({ tema: selecionado.tema, assunto: '', conteudo: '', fonte: '' });
  };

  const abrirInserirConteudo = () => {
    if (!selecionado || !selecionado.assunto) { setError('Selecione um assunto na lista antes de inserir um conteúdo'); return; }
    setModo('conteudo');
    setEditandoId(null);
    setForm({ tema: selecionado.tema, assunto: selecionado.assunto, conteudo: '', fonte: '' });
  };

  const abrirEdicao = (item) => {
    setModo('editar');
    setEditandoId(item.id);
    setForm({ tema: item.tema, assunto: item.assunto, conteudo: item.conteudo, fonte: item.fonte || '' });
    setSelecionado({ tema: item.tema, assunto: item.assunto });
  };

  const cancelarForm = () => {
    setModo(null);
    setEditandoId(null);
    setForm({ tema: '', assunto: '', conteudo: '', fonte: '' });
  };

  const handleSalvar = async () => {
    if (!form.tema.trim() || !form.assunto.trim() || !stripHtml(form.conteudo)) {
      setError('Preencha tema, assunto e conteúdo');
      return;
    }

    setSalvando(true);
    try {
      if (editandoId) {
        const { error: err } = await supabase
          .from('formacao')
          .update({ tema: form.tema.trim(), assunto: form.assunto.trim(), conteudo: form.conteudo.trim(), fonte: form.fonte.trim(), updated_at: new Date() })
          .eq('id', editandoId);
        if (err) throw err;
      } else {
        const qtd = formacao.filter(i => i.tema === form.tema.trim()).length;
        const { error: err } = await supabase.from('formacao').insert({
          tema: form.tema.trim(),
          assunto: form.assunto.trim(),
          conteudo: form.conteudo.trim(),
          fonte: form.fonte.trim(),
          ordem: qtd,
          created_by: user.id
        });
        if (err) throw err;
      }

      setSelecionado({ tema: form.tema.trim(), assunto: form.assunto.trim() });
      cancelarForm();
      await carregarFormacao();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Tem certeza que quer excluir este item?')) return;
    try {
      const { error: err } = await supabase.from('formacao').delete().eq('id', id);
      if (err) throw err;
      await carregarFormacao();
    } catch (err) {
      setError(err.message);
    }
  };

  // ---- Visualizar / Imprimir / WhatsApp ----
  // Gera o PDF a partir do elemento já visível na tela (o conteúdo do modal aberto),
  // evitando os problemas de captura de containers off-screen com html2canvas.
  const gerarPdfDeElemento = async (elemento, filename) => {
    // O elemento fica dentro de um modal com rolagem própria; se estiver rolado,
    // o html2canvas captura só o trecho visível. Volta ao topo antes de capturar.
    const scrollAnterior = elemento.scrollTop;
    elemento.scrollTop = 0;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const html2pdf = await loadHtml2pdf();
    try {
      const blob = await html2pdf().set({
        margin: [8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, ignoreElements: (el) => !!el.classList && el.classList.contains('no-print') },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      }).from(elemento).outputPdf('blob');

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } finally {
      elemento.scrollTop = scrollAnterior;
    }
  };

  const imprimirItem = async (item) => {
    if (!itemPreviewRef.current) return;
    setGerandoPdfId(item.id);
    try {
      await gerarPdfDeElemento(itemPreviewRef.current, `Formacao-${item.assunto.replace(/\s+/g, '-')}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdfId(null);
    }
  };

  const enviarWhatsapp = (item) => {
    const texto = `*${item.tema}*\n*${item.assunto}*\n\n${stripHtml(item.conteudo)}${item.fonte ? `\n\nFonte: ${item.fonte}` : ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const toggleTemaEscolhido = (tema) => {
    setTemasEscolhidos(prev => {
      const novo = new Set(prev);
      if (novo.has(tema)) novo.delete(tema); else novo.add(tema);
      return novo;
    });
  };

  const visualizarLivro = () => {
    if (temasEscolhidos.size === 0) { setError('Selecione ao menos um tema para ver o livro'); return; }
    const temasOrdenados = [...new Set(formacao.map(i => i.tema))].filter(t => temasEscolhidos.has(t));
    const capitulos = temasOrdenados.map(tema => ({ tema, itens: formacao.filter(i => i.tema === tema) }));
    setLivroVisualizando(capitulos);
    setLivroMeta(livroMetaPadrao());
  };

  const fecharLivro = () => {
    setLivroVisualizando(null);
    setLivroMeta(null);
  };

  const handleImagem = (campo) => (e) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    const leitor = new FileReader();
    leitor.onload = () => setLivroMeta(prev => ({ ...prev, [campo]: leitor.result }));
    leitor.readAsDataURL(arquivo);
  };

  const imprimirLivro = async () => {
    if (!livroPreviewRef.current) return;
    setGerandoLivro(true);
    try {
      await gerarPdfDeElemento(livroPreviewRef.current, 'Formacao-Livro.pdf');
      // Limpa o formulário do livro após gerar o PDF
      fecharLivro();
      setTemasEscolhidos(new Set());
    } catch (e) {
      console.error('Erro ao gerar livro:', e);
      alert('Não foi possível gerar o PDF.');
    } finally {
      setGerandoLivro(false);
    }
  };

  const enviarLivroWhatsapp = (capitulos) => {
    const texto = capitulos.map(({ tema, itens }) =>
      `*${tema}*\n` + itens.map(item => `\n*${item.assunto}*\n${stripHtml(item.conteudo)}${item.fonte ? `\n(Fonte: ${item.fonte})` : ''}`).join('\n')
    ).join('\n\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  const btn = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '0.25rem 0.4rem', borderRadius: 3, cursor: 'pointer', display: 'inline-flex' });
  const inputStyle = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' };
  const lockedStyle = { padding: '0.4rem 0.5rem', background: '#e2e8f0', color: '#475569', borderRadius: 4, fontSize: '0.85rem', fontWeight: 600 };

  return (
    <div className="grid-container" style={{ padding: 0 }}>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <AlertCircle size={16} style={{ flex: 'none' }} />
          <span style={{ fontSize: '0.85rem' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><X size={14} /></button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            <th style={{ background: '#1e293b', padding: 0, textAlign: 'left', width: '18%' }}>
              <button onClick={abrirInserirTema}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                <Plus size={14} /> Inserir Tema
              </button>
            </th>
            <th style={{ background: '#1e293b', padding: 0, textAlign: 'left', width: '20%' }}>
              <button onClick={abrirInserirAssunto}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                <Plus size={14} /> Inserir Assunto
              </button>
            </th>
            <th style={{ background: '#1e293b', padding: 0, textAlign: 'left' }}>
              <button onClick={abrirInserirConteudo}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                <Plus size={14} /> Inserir Conteúdo
              </button>
            </th>
            <th style={{ background: '#1e293b', width: '190px', padding: 0 }}>
              <button onClick={visualizarLivro}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#fff', padding: '0.6rem 0.9rem', fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem' }}>
                <BookOpen size={14} /> Imprimir Livro
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const coresTema = ['#dbeafe', '#bbf7d0', '#fef3c7', '#fee2e2', '#f3e8ff', '#ffedd5', '#e0f2fe', '#fce7f3'];
            let temaAnterior = null;
            let temaIndex = -1;
            return formacao.map((item, i) => {
              const primeiraOcorrencia = item.tema !== temaAnterior;
              if (primeiraOcorrencia) temaIndex++;
              temaAnterior = item.tema;
              const isSelected = selecionado?.tema === item.tema && selecionado?.assunto === item.assunto;
              const corTema = coresTema[temaIndex % coresTema.length];
              return (
                <tr key={item.id}
                  onClick={() => setSelecionado({ tema: item.tema, assunto: item.assunto })}
                  style={{ background: isSelected ? '#93c5fd' : corTema, cursor: 'pointer' }}>
                  <td style={{ padding: '0.25rem 0.9rem', fontWeight: 700, color: '#1e293b' }}>
                    {primeiraOcorrencia && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={temasEscolhidos.has(item.tema)} onChange={() => toggleTemaEscolhido(item.tema)} onClick={e => e.stopPropagation()} />
                        {item.tema}
                      </label>
                    )}
                  </td>
                  <td style={{ padding: '0.25rem 0.9rem', color: '#334155' }}>{item.assunto}</td>
                  <td style={{ padding: '0.25rem 0.9rem', color: '#64748b' }}>{primeirasPalavras(item.conteudo)}</td>
                  <td style={{ padding: '0.25rem 0.9rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                      <button onClick={() => setItemVisualizando(item)} title="Visualizar" style={btn('#0ea5e9')}><Eye size={14} /></button>
                      <button onClick={() => abrirEdicao(item)} title="Editar" style={btn('#3b82f6')}><Edit2 size={14} /></button>
                      <button onClick={() => handleExcluir(item.id)} title="Excluir" style={btn('#dc2626')}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            });
          })()}

          {formacao.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Nenhum item cadastrado. Clique em "Inserir Tema" para começar.</td></tr>
          )}
        </tbody>
      </table>

      {/* ---- Segunda folha: formulário de inclusão/edição, sempre abaixo de todos os temas ---- */}
      {modo && (
        <div style={{ background: '#f1f5f9', borderTop: '3px solid #1e293b', padding: '0.9rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Tema</label>
              {modo === 'tema' || modo === 'editar' ? (
                <input type="text" placeholder="Tema" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} style={inputStyle} autoFocus={modo === 'tema'} />
              ) : (
                <div style={lockedStyle}>{form.tema}</div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Assunto</label>
              {modo === 'tema' || modo === 'assunto' || modo === 'editar' ? (
                <input type="text" placeholder="Assunto" value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} style={inputStyle} autoFocus={modo === 'assunto'} />
              ) : (
                <div style={lockedStyle}>{form.assunto}</div>
              )}
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Conteúdo</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <ConteudoEditor
              key={editandoId || modo}
              value={form.conteudo}
              onChange={c => setForm(f => ({ ...f, conteudo: c }))}
              autoFocus={modo === 'conteudo' || modo === 'editar'}
            />
          </div>

          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Fonte (opcional)</label>
          <textarea placeholder="Fonte" value={form.fonte} onChange={e => setForm({ ...form, fonte: e.target.value })} rows="6"
            style={{ ...inputStyle, fontFamily: 'inherit', marginBottom: '0.7rem', minHeight: '120px' }} />

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

      {/* ---- Modal de visualização (antes de imprimir/enviar) ---- */}
      {itemVisualizando && (
        <div onClick={() => setItemVisualizando(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar</span>
              <button onClick={() => setItemVisualizando(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div ref={itemPreviewRef} style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '0 0 0.3rem', color: '#1e293b' }}>{itemVisualizando.tema}</h1>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.7rem', color: '#1e293b' }}>{itemVisualizando.assunto}</h2>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.5, color: '#334155', margin: 0, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.conteudo) }} />
              {itemVisualizando.fonte && (
                <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>Fonte: {itemVisualizando.fonte}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => imprimirItem(itemVisualizando)} disabled={gerandoPdfId === itemVisualizando.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                {gerandoPdfId === itemVisualizando.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Printer size={14} />} Imprimir
              </button>
              <button onClick={() => enviarWhatsapp(itemVisualizando)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
              <button onClick={() => setItemVisualizando(null)}
                style={{ marginLeft: 'auto', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal de visualização do livro (antes de imprimir/enviar) ---- */}
      {livroVisualizando && (
        <div onClick={() => fecharLivro()}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: '640px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar Livro</span>
              <button onClick={() => fecharLivro()} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div ref={livroPreviewRef} style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif', lineHeight: 1.5 }}>
              {livroMeta && (() => {
                const pagina = { breakAfter: 'page', minHeight: '60vh', display: 'flex', flexDirection: 'column' };
                const editInput = { border: '1px dashed #cbd5e1', borderRadius: 4, padding: '0.3rem 0.5rem', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit', textAlign: 'inherit', width: '100%', background: 'transparent' };
                const editTextarea = { ...editInput, resize: 'vertical' };
                const set = (campo) => (e) => setLivroMeta(prev => ({ ...prev, [campo]: e.target.value }));
                return (
                  <>
                    {/* ---- CAPA (editável) ---- */}
                    <div style={{ ...pagina, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      {livroMeta.capaImagem && <img src={livroMeta.capaImagem} alt="Capa" style={{ maxWidth: '220px', maxHeight: '220px', objectFit: 'contain', marginBottom: '1rem' }} />}
                      <label className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', marginBottom: '1rem' }}>
                        <ImageIcon size={13} /> {livroMeta.capaImagem ? 'Trocar imagem da capa' : 'Inserir imagem na capa (explorar)'}
                        <input type="file" accept="image/*" onChange={handleImagem('capaImagem')} style={{ display: 'none' }} />
                      </label>
                      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.4rem' }}>Formação e Estudos</h1>
                      <input value={livroMeta.subtitulo} onChange={set('subtitulo')} style={{ ...editInput, fontSize: '1rem', color: '#334155', marginBottom: '2rem', maxWidth: '420px' }} />
                      <input value={livroMeta.autor} onChange={set('autor')} style={{ ...editInput, fontSize: '0.85rem', color: '#64748b', maxWidth: '300px' }} />
                      <input value={livroMeta.ano} onChange={set('ano')} style={{ ...editInput, fontSize: '0.85rem', color: '#64748b', maxWidth: '120px', marginTop: '0.2rem' }} />
                    </div>

                    {/* ---- FOLHA DE ROSTO ---- */}
                    <div style={{ ...pagina, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.5rem' }}>{livroMeta.autor}</p>
                      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.4rem' }}>Formação e Estudos</h1>
                      <p style={{ fontSize: '0.95rem', color: '#334155', margin: '0 0 2rem' }}>{livroMeta.subtitulo}</p>
                      <textarea value={livroMeta.folhaRostoTexto} onChange={set('folhaRostoTexto')} rows={3}
                        style={{ ...editTextarea, fontSize: '0.82rem', color: '#475569', maxWidth: '420px', lineHeight: 1.5, marginBottom: '2rem', textAlign: 'justify' }} />
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Zelus Domus — {livroMeta.ano}</p>
                    </div>

                    {/* ---- DEDICATÓRIA ---- */}
                    <div style={{ ...pagina, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }} className="no-print">DEDICATÓRIA</label>
                      <textarea value={livroMeta.dedicatoria} onChange={set('dedicatoria')} rows={4}
                        style={{ ...editTextarea, fontSize: '0.9rem', color: '#334155', fontStyle: 'italic', maxWidth: '380px', lineHeight: 1.6 }} />
                    </div>

                    {/* ---- AGRADECIMENTOS ---- */}
                    <div style={pagina}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.8rem' }}>Agradecimentos</h2>
                      <textarea value={livroMeta.agradecimentos} onChange={set('agradecimentos')} rows={5}
                        style={{ ...editTextarea, fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, textAlign: 'justify' }} />
                    </div>

                    {/* ---- EPÍGRAFE ---- */}
                    <div style={{ ...pagina, alignItems: 'center', justifyContent: 'center', textAlign: 'right' }}>
                      <textarea value={livroMeta.epigrafe} onChange={set('epigrafe')} rows={2}
                        style={{ ...editTextarea, fontSize: '0.95rem', color: '#334155', fontStyle: 'italic', maxWidth: '380px', lineHeight: 1.6, textAlign: 'right' }} />
                      <input value={livroMeta.epigrafeFonte} onChange={set('epigrafeFonte')}
                        style={{ ...editInput, fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', maxWidth: '250px', textAlign: 'right' }} />
                    </div>

                    {/* ---- RESUMO ---- */}
                    <div style={pagina}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.8rem' }}>Resumo</h2>
                      <textarea value={livroMeta.resumo || `Esta obra reúne ${livroVisualizando.length} ${livroVisualizando.length === 1 ? 'tema' : 'temas'} de formação voltados à preparação dos servidores do altar, abordando aspectos litúrgicos, espirituais e práticos do serviço no altar.`}
                        onChange={set('resumo')} rows={4} style={{ ...editTextarea, fontSize: '0.88rem', color: '#334155', lineHeight: 1.6, marginBottom: '0.8rem', textAlign: 'justify' }} />
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', fontSize: '0.8rem', color: '#64748b' }}>
                        <strong>Palavras-chave:</strong>
                        <input value={livroMeta.palavrasChave} onChange={set('palavrasChave')} style={{ ...editInput, fontSize: '0.8rem', color: '#64748b', flex: 1 }} />
                      </div>
                    </div>

                    {/* ---- SUMÁRIO ---- */}
                    <div style={pagina}>
                      <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.8rem' }}>Sumário</h2>
                      {livroVisualizando.map(({ tema }, idx) => (
                        <div key={tema} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', color: '#334155', padding: '0.3rem 0', borderBottom: '1px dotted #cbd5e1' }}>
                          <span>{idx + 1}. {tema}</span>
                        </div>
                      ))}
                    </div>

                    {/* ---- CAPÍTULOS (cada tema em página própria — fica como está, gerado a partir de Formação Cadastro) ---- */}
                    {livroVisualizando.map(({ tema, itens }, idx) => (
                      <div key={tema} style={{ breakBefore: 'page', marginBottom: '1.4rem' }}>
                        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: '0 0 0.6rem', color: '#1e293b', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.3rem' }}>
                          Capítulo {idx + 1} — {tema}
                        </h2>
                        {itens.map(item => (
                          <div key={item.id} style={{ marginBottom: '0.9rem' }}>
                            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 0.2rem', color: '#1e293b' }}>{item.assunto}</h3>
                            <div style={{ fontSize: '0.88rem', lineHeight: 1.5, color: '#334155', margin: 0, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(item.conteudo) }} />
                            {item.fonte && <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.3rem', paddingTop: '0.3rem', borderTop: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', textAlign: 'justify' }}>Fonte: {item.fonte}</p>}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* ---- CAPA FINAL (editável: imagem e/ou texto) ---- */}
                    <div style={{ breakBefore: 'page', ...pagina, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                      {livroMeta.capaFinalImagem && <img src={livroMeta.capaFinalImagem} alt="Capa final" style={{ maxWidth: '260px', maxHeight: '260px', objectFit: 'contain', marginBottom: '1rem' }} />}
                      <label className="no-print" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#2563eb', cursor: 'pointer', marginBottom: '1rem' }}>
                        <ImageIcon size={13} /> {livroMeta.capaFinalImagem ? 'Trocar imagem da capa final' : 'Inserir imagem na capa final (explorar)'}
                        <input type="file" accept="image/*" onChange={handleImagem('capaFinalImagem')} style={{ display: 'none' }} />
                      </label>
                      <textarea value={livroMeta.capaFinalTexto} onChange={set('capaFinalTexto')} rows={3} placeholder="Texto da contracapa (opcional)"
                        style={{ ...editTextarea, fontSize: '0.9rem', color: '#334155', maxWidth: '380px', lineHeight: 1.6 }} />
                    </div>
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={imprimirLivro} disabled={gerandoLivro}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: gerandoLivro ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                {gerandoLivro ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Printer size={14} />} {gerandoLivro ? 'Gerando…' : 'Imprimir'}
              </button>
              <button onClick={() => enviarLivroWhatsapp(livroVisualizando)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
              <button onClick={() => fecharLivro()}
                style={{ marginLeft: 'auto', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
