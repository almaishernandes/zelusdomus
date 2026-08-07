import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Save, X, AlertCircle, Loader, Eye, MessageCircle, Printer, FileText, Bold, Underline, Italic, ChevronLeft } from 'lucide-react';

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
        style={{ width: '100%', minHeight: '280px', height: '280px', padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.9rem', lineHeight: 1.5, background: '#fff', overflowY: 'auto', resize: 'vertical' }}
      />
    </div>
  );
}

export function AtaReuniaoModule({ setHeaderExtra }) {
  const { user } = useAuth();
  const [formacao, setFormacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState(null);
  const [gerandoAta, setGerandoAta] = useState(false);

  const [selecionado, setSelecionado] = useState(null); // { tema, assunto }
  const [itemVisualizando, setItemVisualizando] = useState(null);
  const [ataVisualizando, setAtaVisualizando] = useState(null); // { tema, itens } selecionado
  const [ataMeta, setAtaMeta] = useState(null);
  const itemPreviewRef = useRef(null);
  const ataPreviewRef = useRef(null);

  const podeCompartilharArquivo = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([new Blob()], 'f.png', { type: 'image/png' })] });

  // Ao abrir cada modal, garante que a visualização comece do topo do documento
  useEffect(() => {
    if (itemVisualizando && itemPreviewRef.current) itemPreviewRef.current.scrollTop = 0;
  }, [itemVisualizando]);

  useEffect(() => {
    if (ataVisualizando && ataPreviewRef.current) ataPreviewRef.current.scrollTop = 0;
  }, [ataVisualizando]);

  const ataMetaPadrao = () => ({
    paroquia: 'Paróquia / Comunidade',
    data: new Date().toLocaleDateString('pt-BR'),
    horario: '',
    local: '',
    presentesCoordenacao: '',
    presentesServidores: '',
    avaliacoes: '',
    planoAcao: [{ tarefa: '', responsavel: '', prazo: '' }],
    nomeCoordenacao: '',
    nomeAssessor: '',
    nomeSecretario: ''
  });

  // modo: null | 'tema' | 'assunto' | 'conteudo' | 'editar'
  const [modo, setModo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ tema: '', assunto: '', conteudo: '', fonte: '', local: '', data_reuniao: '', horario: '', anotacoes_decisoes: '' });

  const CONVITE_PADRAO = 'Com muito carinho e dedicação convidamos você que é Servidor de Altar do Senhor a participar';

  useEffect(() => {
    carregarFormacao();
  }, []);

  const carregarFormacao = async () => {
    try {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('atas_reuniao')
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

  // ---- Abrir formulário (segunda folha, abaixo de todos os temas) ----
  const abrirInserirTema = () => {
    setModo('tema');
    setEditandoId(null);
    setForm({ tema: '', assunto: '', conteudo: '', fonte: CONVITE_PADRAO, local: '', data_reuniao: '', horario: '', anotacoes_decisoes: '' });
  };

  // Botão "+" injetado na 1ª linha do cabeçalho do app, ao lado de Sair —
  // é o único jeito de abrir "Inserir Reunião" agora (saiu da tabela).
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(
      <button type="button" onClick={abrirInserirTema} title="Inserir Reunião"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
        <Plus size={18} />
      </button>
    );
    return () => setHeaderExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderExtra]);

  const abrirEdicao = (item) => {
    setModo('editar');
    setEditandoId(item.id);
    setForm({ tema: item.tema, assunto: item.assunto, conteudo: item.conteudo, fonte: item.fonte || CONVITE_PADRAO, local: item.local || '', data_reuniao: item.data_reuniao || '', horario: item.horario || '', anotacoes_decisoes: item.anotacoes_decisoes || '' });
    setSelecionado({ tema: item.tema, assunto: item.assunto });
  };

  const cancelarForm = () => {
    setModo(null);
    setEditandoId(null);
    setForm({ tema: '', assunto: '', conteudo: '', fonte: '', local: '', data_reuniao: '', horario: '', anotacoes_decisoes: '' });
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
          .from('atas_reuniao')
          .update({
            tema: form.tema.trim(), assunto: form.assunto.trim(), conteudo: form.conteudo.trim(), fonte: form.fonte.trim(),
            local: form.local.trim(), data_reuniao: form.data_reuniao.trim(), horario: form.horario.trim(),
            anotacoes_decisoes: form.anotacoes_decisoes.trim(),
            updated_at: new Date()
          })
          .eq('id', editandoId);
        if (err) throw err;
      } else {
        const qtd = formacao.filter(i => i.tema === form.tema.trim()).length;
        const { error: err } = await supabase.from('atas_reuniao').insert({
          tema: form.tema.trim(),
          assunto: form.assunto.trim(),
          conteudo: form.conteudo.trim(),
          fonte: form.fonte.trim(),
          local: form.local.trim(),
          data_reuniao: form.data_reuniao.trim(),
          horario: form.horario.trim(),
          anotacoes_decisoes: form.anotacoes_decisoes.trim(),
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
    if (!window.confirm('Tem certeza que quer excluir esta reunião?')) return;
    try {
      const { error: err } = await supabase.from('atas_reuniao').delete().eq('id', id);
      if (err) throw err;
      if (editandoId === id) cancelarForm();
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

  // Gera o arquivo formatado igual à tela e já abre o compartilhamento nativo
  // (WhatsApp, Instagram etc.) quando o navegador suporta; senão, baixa o PDF
  // e abre o WhatsApp com o texto como alternativa.
  const compartilharItem = async (item) => {
    if (!itemPreviewRef.current) return;
    setGerandoPdfId(item.id);
    const elemento = itemPreviewRef.current;
    const scrollAnterior = elemento.scrollTop;
    elemento.scrollTop = 0;
    try {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const html2pdf = await loadHtml2pdf();
      const filename = `Convite-${item.assunto.replace(/\s+/g, '-')}.png`;
      // Gera uma imagem (não PDF) — é o formato que abre como "card" com prévia
      // visual no WhatsApp/Instagram, em vez de um documento anexado.
      const canvas = await html2pdf().set({
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0, ignoreElements: (el) => !!el.classList && el.classList.contains('no-print') }
      }).from(elemento).toCanvas().get('canvas');

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));

      if (podeCompartilharArquivo) {
        const file = new File([blob], filename, { type: 'image/png' });
        await navigator.share({ files: [file], title: 'Convite de Participação', text: `${item.tema} — ${item.assunto}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        alert('Imagem do convite baixada. Anexe o arquivo na conversa do WhatsApp ou na rede social desejada.');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error('Erro ao gerar/enviar arquivo:', e);
        alert('Não foi possível gerar o arquivo.');
      }
    } finally {
      elemento.scrollTop = scrollAnterior;
      setGerandoPdfId(null);
    }
  };

  // ---- Ata de Reunião (gerada a partir do tema/reunião selecionado) ----
  const visualizarAta = () => {
    if (!selecionado) { setError('Selecione um tema/reunião na lista antes de gerar a ata'); return; }
    const itens = formacao.filter(i => i.tema === selecionado.tema);
    setAtaVisualizando({ tema: selecionado.tema, itens });
    const base = itens[0] || {};
    setAtaMeta({
      ...ataMetaPadrao(),
      local: base.local || '',
      horario: base.horario || '',
      data: base.data_reuniao || new Date().toLocaleDateString('pt-BR')
    });
  };

  const fecharAta = () => {
    setAtaVisualizando(null);
    setAtaMeta(null);
  };

  const setAtaCampo = (campo) => (e) => setAtaMeta(prev => ({ ...prev, [campo]: e.target.value }));

  const atualizarPlanoAcao = (idx, campo, valor) => {
    setAtaMeta(prev => {
      const planoAcao = [...prev.planoAcao];
      planoAcao[idx] = { ...planoAcao[idx], [campo]: valor };
      return { ...prev, planoAcao };
    });
  };

  const adicionarLinhaPlanoAcao = () => {
    setAtaMeta(prev => ({ ...prev, planoAcao: [...prev.planoAcao, { tarefa: '', responsavel: '', prazo: '' }] }));
  };

  const removerLinhaPlanoAcao = (idx) => {
    setAtaMeta(prev => ({ ...prev, planoAcao: prev.planoAcao.filter((_, i) => i !== idx) }));
  };

  const imprimirAta = async () => {
    if (!ataPreviewRef.current) return;
    setGerandoAta(true);
    try {
      const nomeArquivo = `Ata-${(ataVisualizando?.tema || 'Reuniao').replace(/\s+/g, '-')}.pdf`;
      await gerarPdfDeElemento(ataPreviewRef.current, nomeArquivo);
      fecharAta();
    } catch (e) {
      console.error('Erro ao gerar ata:', e);
      alert('Não foi possível gerar o PDF.');
    } finally {
      setGerandoAta(false);
    }
  };

  const enviarAtaWhatsapp = () => {
    const linhasPauta = ataVisualizando.itens.length > 0
      ? ataVisualizando.itens.map(item => `\n*${item.assunto}*\n${stripHtml(item.conteudo)}`).join('\n')
      : 'Nenhum assunto cadastrado.';
    const planoAcaoTexto = ataMeta.planoAcao
      .filter(l => l.tarefa || l.responsavel || l.prazo)
      .map(l => `- ${l.tarefa || '(sem tarefa)'} | Responsável: ${l.responsavel || '-'} | Prazo: ${l.prazo || '-'}`)
      .join('\n') || 'Nenhuma tarefa registrada.';

    const texto = `*Ata de Reunião de Servidores do Altar*\n` +
      `${ataMeta.paroquia}\n` +
      `Tema: *${ataVisualizando.tema}*\n` +
      `Data: ${ataMeta.data}${ataMeta.horario ? ` — ${ataMeta.horario}` : ''}${ataMeta.local ? ` — ${ataMeta.local}` : ''}\n\n` +
      `*Presença*\nCoordenação: ${ataMeta.presentesCoordenacao || '-'}\nServidores: ${ataMeta.presentesServidores || '-'}\n\n` +
      `*Pauta & Formação*${linhasPauta}\n\n` +
      `*Avaliações e Decisões*\n${ataMeta.avaliacoes || '-'}\n\n` +
      `*Plano de Ação*\n${planoAcaoTexto}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  const inputStyle = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' };
  const lockedStyle = { padding: '0.4rem 0.5rem', background: '#e2e8f0', color: '#475569', borderRadius: 4, fontSize: '0.85rem', fontWeight: 600 };

  return (
    <div className="grid-container" style={{ padding: 0 }}>
      <style>{`
        @media (max-width: 680px) {
          .ata-col-conteudo { display: none !important; }
          .ata-list-header th { font-size: 0.76rem !important; padding: 0.5rem 0.6rem !important; }
          .ata-list-header th:first-child button,
          .ata-list-header th:last-child button { font-size: 0.74rem !important; padding: 0.5rem 0.5rem !important; white-space: normal !important; }
          .ata-list td { padding: 0.4rem 0.6rem !important; font-size: 0.82rem !important; }

          /* Formulário: linha 1 = Reunião + Assunto, linha 2 = botões de ação
             (Local/Data/Horário e o resto do formulário seguem abaixo) */
          .ata-form-body { display: flex !important; flex-direction: column !important; }
          .ata-form-body > .ata-form-grid { order: 1 !important; }
          .ata-form-body > .ata-form-actions { order: 2 !important; }
          .ata-form-body > :not(.ata-form-grid):not(.ata-form-actions) { order: 3 !important; }

          .ata-form-actions { flex-wrap: wrap !important; }
          .ata-form-actions button { flex: 1 1 auto !important; justify-content: center !important; }
        }
      `}</style>
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.6rem 0.9rem', display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <AlertCircle size={16} style={{ flex: 'none' }} />
          <span style={{ fontSize: '0.85rem' }}>{error}</span>
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}><X size={14} /></button>
        </div>
      )}

      <table className="ata-list" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead className="ata-list-header">
          <tr>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.7rem', textAlign: 'left', width: '220px', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              Reunião
            </th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.7rem', textAlign: 'left', width: '110px', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              Data
            </th>
            <th style={{ background: '#1e293b', padding: '0.6rem 0.7rem', textAlign: 'left', width: '90px', color: '#fff', fontWeight: 700, fontSize: '0.82rem' }}>
              Horário
            </th>
            <th style={{ background: '#1e293b', padding: 0 }}></th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const coresTema = ['#dbeafe', '#bbf7d0', '#fef3c7', '#fee2e2', '#f3e8ff', '#ffedd5', '#e0f2fe', '#fce7f3'];
            let temaAnterior = null;
            let temaIndex = -1;
            return formacao.map((item) => {
              if (item.tema !== temaAnterior) temaIndex++;
              temaAnterior = item.tema;
              const isSelected = editandoId === item.id;
              const corTema = coresTema[temaIndex % coresTema.length];
              const bgLinha = isSelected ? '#93c5fd' : corTema;
              return (
                <tr key={item.id}
                  onClick={() => abrirEdicao(item)}
                  style={{ background: bgLinha, cursor: 'pointer' }}>
                  <td style={{ padding: '0.4rem 0.7rem', fontWeight: 700, color: '#1e293b' }}>{item.tema}</td>
                  <td style={{ padding: '0.4rem 0.7rem', color: '#334155', textAlign: 'left' }}>{item.data_reuniao || '-'}</td>
                  <td style={{ padding: '0.4rem 0.7rem', color: '#334155', textAlign: 'left' }}>{item.horario || '-'}</td>
                  <td style={{ background: bgLinha, padding: 0 }}></td>
                </tr>
              );
            });
          })()}

          {formacao.length === 0 && (
            <tr><td colSpan={4} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>Nenhuma reunião cadastrada. Clique no + ao lado de "Sair" para começar.</td></tr>
          )}
        </tbody>
      </table>

      {/* ---- Segunda folha: formulário de inclusão/edição, sempre abaixo de todos os temas ---- */}
      {modo && (
        <div className="ata-form-body" style={{ background: '#f1f5f9', borderTop: '3px solid #1e293b', padding: '0.9rem' }}>
          <div className="ata-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem', marginBottom: '0.7rem', width: '560px', maxWidth: '100%' }}>
            <div className="ata-field-tema">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Reunião Nº</label>
              {modo === 'tema' || modo === 'editar' ? (
                <input type="text" placeholder="Reunião Nº" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} style={inputStyle} autoFocus={modo === 'tema'} />
              ) : (
                <div style={lockedStyle}>{form.tema}</div>
              )}
            </div>
            <div className="ata-field-assunto">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Assunto/Tema</label>
              {modo === 'tema' || modo === 'assunto' || modo === 'editar' ? (
                <input type="text" placeholder="Assunto/Tema" value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} style={inputStyle} autoFocus={modo === 'assunto'} />
              ) : (
                <div style={lockedStyle}>{form.assunto}</div>
              )}
            </div>
            <div className="ata-field-local">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Local</label>
              <input type="text" placeholder="Local da reunião" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <div className="ata-field-data">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Data</label>
                <input type="date" value={form.data_reuniao} onChange={e => setForm({ ...form, data_reuniao: e.target.value })} style={inputStyle} />
              </div>
              <div className="ata-field-horario">
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Horário</label>
                <input type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Convite de Participação</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <ConteudoEditor
              key={`fonte-${editandoId || modo}`}
              value={form.fonte}
              onChange={c => setForm(f => ({ ...f, fonte: c }))}
            />
          </div>

          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Ordem do Dia</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <ConteudoEditor
              key={`conteudo-${editandoId || modo}`}
              value={form.conteudo}
              onChange={c => setForm(f => ({ ...f, conteudo: c }))}
              autoFocus={modo === 'conteudo' || modo === 'editar'}
            />
          </div>

          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Anotações das Decisões</label>
          <div style={{ marginBottom: '0.5rem' }}>
            <ConteudoEditor
              key={`anotacoes-${editandoId || modo}`}
              value={form.anotacoes_decisoes}
              onChange={c => setForm(f => ({ ...f, anotacoes_decisoes: c }))}
            />
          </div>

          <div className="ata-form-actions" style={{ display: 'flex', gap: '0.4rem' }}>
            <button onClick={handleSalvar} disabled={salvando}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              {salvando ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Salvar
            </button>
            <button onClick={cancelarForm} title="Voltar"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 0.7rem', borderRadius: 4, cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            {editandoId && (
              <button onClick={() => setItemVisualizando(formacao.find(i => i.id === editandoId))}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                <Eye size={14} /> Convite
              </button>
            )}
            <button onClick={visualizarAta}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#ca8a04', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
              <FileText size={14} /> Imprimir Ata
            </button>
            {editandoId && (
              <button onClick={() => handleExcluir(editandoId)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#dc2626', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
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
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Convite</span>
              <button onClick={() => setItemVisualizando(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div ref={itemPreviewRef} style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif' }}>
              <div style={{ fontSize: '0.98rem', lineHeight: 1.6, color: '#1e293b', margin: '0 0 1.1rem', fontStyle: 'italic', textAlign: 'justify' }}
                dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.fonte || CONVITE_PADRAO) }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '1rem' }}><tbody>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Reunião:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>{itemVisualizando.tema}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Assunto:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>{itemVisualizando.assunto}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Local/Data/Horário:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>
                    {[itemVisualizando.local, itemVisualizando.data_reuniao, itemVisualizando.horario].filter(Boolean).join(' — ') || ' '}
                  </td>
                </tr>
              </tbody></table>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.3rem' }}>Ordem do dia:</p>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.5, color: '#334155', margin: '0 0 1rem', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.conteudo) }} />
              {stripHtml(itemVisualizando.anotacoes_decisoes) && (
                <>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.3rem' }}>Anotações das Decisões:</p>
                  <div style={{ fontSize: '0.92rem', lineHeight: 1.5, color: '#334155', margin: 0, textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.anotacoes_decisoes) }} />
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={() => compartilharItem(itemVisualizando)} disabled={gerandoPdfId === itemVisualizando.id}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: gerandoPdfId === itemVisualizando.id ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                {gerandoPdfId === itemVisualizando.id ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <MessageCircle size={14} />} {gerandoPdfId === itemVisualizando.id ? 'Gerando…' : 'Enviar'}
              </button>
              <button onClick={() => setItemVisualizando(null)}
                style={{ marginLeft: 'auto', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Modal de visualização da Ata de Reunião (antes de imprimir) ---- */}
      {ataVisualizando && ataMeta && (
        <div onClick={fecharAta}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar Ata de Reunião</span>
              <button onClick={fecharAta} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            <div ref={ataPreviewRef} style={{ padding: '0.9rem 1.2rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif', lineHeight: 1.25 }}>
              {(() => {
                const editInput = { border: '1px dashed #cbd5e1', borderRadius: 3, padding: '0.15rem 0.4rem', fontSize: 'inherit', fontFamily: 'inherit', color: 'inherit', width: '100%', background: 'transparent' };
                const editTextarea = { ...editInput, resize: 'vertical' };
                const rotulo = { display: 'inline-block', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', marginRight: '0.4rem' };
                const secao = { marginBottom: '0.5rem' };
                return (
                  <>
                    {/* ---- CABEÇALHO ---- */}
                    <div style={{ textAlign: 'center', marginBottom: '0.6rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.4rem' }}>
                      <input value={ataMeta.paroquia} onChange={setAtaCampo('paroquia')}
                        style={{ ...editInput, textAlign: 'center', fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.15rem' }} />
                      <h1 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.3rem' }}>
                        Ata de Reunião de Servidores do Altar
                      </h1>
                      <p style={{ fontSize: '0.85rem', color: '#334155', margin: 0 }}>
                        Tema: <strong>{ataVisualizando.tema}</strong>
                        <span style={{ margin: '0 0.4rem', color: '#cbd5e1' }}>|</span>
                        <span style={rotulo}>Data</span><input value={ataMeta.data} onChange={setAtaCampo('data')} style={{ ...editInput, display: 'inline', width: '90px' }} />
                        <span style={{ margin: '0 0.4rem', color: '#cbd5e1' }}>|</span>
                        <span style={rotulo}>Horário</span><input value={ataMeta.horario} onChange={setAtaCampo('horario')} placeholder="00:00" style={{ ...editInput, display: 'inline', width: '60px' }} />
                        <span style={{ margin: '0 0.4rem', color: '#cbd5e1' }}>|</span>
                        <span style={rotulo}>Local</span><input value={ataMeta.local} onChange={setAtaCampo('local')} placeholder="Local" style={{ ...editInput, display: 'inline', width: '140px' }} />
                      </p>
                    </div>

                    {/* ---- PRESENÇA ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.15rem' }}>Presença</h2>
                      <p style={{ fontSize: '0.8rem', margin: '0 0 0.15rem' }}>
                        <strong>Coordenação:</strong> <input value={ataMeta.presentesCoordenacao} onChange={setAtaCampo('presentesCoordenacao')} placeholder="Nomes" style={{ ...editInput, display: 'inline', width: 'calc(100% - 95px)' }} />
                      </p>
                      <p style={{ fontSize: '0.8rem', margin: 0 }}>
                        <strong>Servidores:</strong> <input value={ataMeta.presentesServidores} onChange={setAtaCampo('presentesServidores')} placeholder="Nomes" style={{ ...editInput, display: 'inline', width: 'calc(100% - 95px)' }} />
                      </p>
                    </div>

                    {/* ---- PAUTA & FORMAÇÃO ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.15rem' }}>Pauta &amp; Formação</h2>
                      {ataVisualizando.itens.length > 0 ? ataVisualizando.itens.map(item => (
                        <div key={item.id} style={{ marginBottom: '0.25rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>{item.assunto}: </span>
                          <span style={{ fontSize: '0.82rem', color: '#334155', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(item.conteudo) }} />
                        </div>
                      )) : (
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Nenhum assunto cadastrado para esta reunião.</p>
                      )}
                    </div>

                    {/* ---- AVALIAÇÕES E DECISÕES ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.15rem' }}>Avaliações e Decisões</h2>
                      <textarea value={ataMeta.avaliacoes} onChange={setAtaCampo('avaliacoes')} rows={2}
                        placeholder="Pontos de atenção sobre o serviço no altar, escalas, comportamento, pontualidade, etc."
                        style={{ ...editTextarea, fontSize: '0.82rem', textAlign: 'justify' }} />
                    </div>

                    {/* ---- PLANO DE AÇÃO ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.15rem' }}>Plano de Ação</h2>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem' }}>Tarefa</th>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem', width: '30%' }}>Responsável</th>
                            <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem', width: '20%' }}>Prazo</th>
                            <th className="no-print" style={{ width: '30px', borderBottom: '1px solid #1e293b' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {ataMeta.planoAcao.map((linha, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>
                                <input value={linha.tarefa} onChange={e => atualizarPlanoAcao(idx, 'tarefa', e.target.value)} style={editInput} />
                              </td>
                              <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>
                                <input value={linha.responsavel} onChange={e => atualizarPlanoAcao(idx, 'responsavel', e.target.value)} style={editInput} />
                              </td>
                              <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>
                                <input value={linha.prazo} onChange={e => atualizarPlanoAcao(idx, 'prazo', e.target.value)} style={editInput} />
                              </td>
                              <td className="no-print" style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                                <button onClick={() => removerLinhaPlanoAcao(idx)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, padding: '0.2rem 0.35rem', cursor: 'pointer' }}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <button onClick={adicionarLinhaPlanoAcao} className="no-print"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: '1px dashed #94a3b8', color: '#475569', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginTop: '0.4rem' }}>
                        <Plus size={12} /> Adicionar linha
                      </button>
                    </div>

                    {/* ---- ASSINATURAS ---- */}
                    <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', textAlign: 'center' }}>
                      <div>
                        <input value={ataMeta.nomeCoordenacao} onChange={setAtaCampo('nomeCoordenacao')} placeholder=" " style={{ ...editInput, textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #1e293b', borderRadius: 0 }} />
                        <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>Coordenação</p>
                      </div>
                      <div>
                        <input value={ataMeta.nomeAssessor} onChange={setAtaCampo('nomeAssessor')} placeholder=" " style={{ ...editInput, textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #1e293b', borderRadius: 0 }} />
                        <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>Assessor Pastoral / Padre</p>
                      </div>
                      <div>
                        <input value={ataMeta.nomeSecretario} onChange={setAtaCampo('nomeSecretario')} placeholder=" " style={{ ...editInput, textAlign: 'center', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: '1px solid #1e293b', borderRadius: 0 }} />
                        <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>Secretário(a)</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={imprimirAta} disabled={gerandoAta}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: gerandoAta ? 'wait' : 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                {gerandoAta ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Printer size={14} />} {gerandoAta ? 'Gerando…' : 'Imprimir'}
              </button>
              <button onClick={enviarAtaWhatsapp}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                <MessageCircle size={14} /> Enviar por WhatsApp
              </button>
              <button onClick={fecharAta}
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
