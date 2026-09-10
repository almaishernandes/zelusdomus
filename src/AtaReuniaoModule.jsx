import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { Plus, Trash2, Save, X, AlertCircle, Loader, Eye, MessageCircle, Printer, FileText, Bold, Underline, Italic, Video, MapPin } from 'lucide-react';

const loadHtml2pdf = () => import('html2pdf.js').then(m => m.default);

const stripHtml = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Formata dd/mmm/aaaa (ex: 01/Ago/2026) a partir de yyyy-mm-dd (seletor) ou dd/mm/aaaa (formato antigo)
const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const fmtDataAbrev = (v) => {
  if (!v) return '';
  let d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) d = new Date(v + 'T00:00:00');
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) { const [dd, mm, yyyy] = v.split('/'); d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`); }
  else return v;
  if (isNaN(d)) return v;
  return `${String(d.getDate()).padStart(2, '0')}/${MESES_ABREV[d.getMonth()]}/${d.getFullYear()}`;
};

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
        style={{ width: '100%', minHeight: '90px', height: 'auto', padding: '0.5rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.9rem', lineHeight: 1.5, background: '#fff', overflowY: 'auto', resize: 'vertical' }}
      />
    </div>
  );
}

export function AtaReuniaoModule({ setHeaderExtra, servers = [] }) {
  const { user } = useAuth();
  // Convidados (só para reunião online): cadastros marcados + status atual de cada um
  const [convidados, setConvidados] = useState([]);            // ['001', '004', ...]
  const [convidadosStatus, setConvidadosStatus] = useState({}); // { '001': 'aceito', ... }
  const cadastrosDisponiveis = React.useMemo(() => {
    const vistos = new Set();
    return servers
      .filter(s => s.cadastro && !vistos.has(s.cadastro) && vistos.add(s.cadastro))
      .map(s => ({ cadastro: String(s.cadastro), nome: s.full_name || s.nome || `Cadastro ${s.cadastro}` }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [servers]);
  const [formacao, setFormacao] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gerandoPdfId, setGerandoPdfId] = useState(null);
  const [gerandoAta, setGerandoAta] = useState(false);

  const [selecionado, setSelecionado] = useState(null); // { tema, assunto }
  const [itemVisualizando, setItemVisualizando] = useState(null);
  const [ataVisualizando, setAtaVisualizando] = useState(null); // reunião (item) sendo visualizada
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

  // modo: null | 'tema' | 'assunto' | 'conteudo' | 'editar'
  const [modo, setModo] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({ tema: '', assunto: '', conteudo: '', fonte: '', local: '', data_reuniao: '', horario: '', tipo: 'presencial', link_reuniao: '', anotacoes_decisoes: [{ tarefa: '', responsavel: '', prazo: '' }] });

  const CONVITE_PADRAO = 'Com muito carinho e dedicação convidamos você que é Servidor de Altar do Senhor a participar';

  const parseAnotacoes = (raw) => {
    try {
      const arr = JSON.parse(raw || '[]');
      if (Array.isArray(arr) && arr.length) return arr;
    } catch { /* formato antigo (texto simples) — descartado, começa do zero */ }
    return [{ tarefa: '', responsavel: '', prazo: '' }];
  };

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
    setConvidados([]);
    setConvidadosStatus({});
    setForm({ tema: '', assunto: '', conteudo: '', fonte: CONVITE_PADRAO, local: '', data_reuniao: '', horario: '', tipo: 'presencial', link_reuniao: '', anotacoes_decisoes: [{ tarefa: '', responsavel: '', prazo: '' }] });
  };

  const abrirEdicao = async (item) => {
    setModo('editar');
    setEditandoId(item.id);
    setForm({ tema: item.tema, assunto: item.assunto, conteudo: item.conteudo, fonte: item.fonte || CONVITE_PADRAO, local: item.local || '', data_reuniao: item.data_reuniao || '', horario: item.horario || '', tipo: item.tipo || 'presencial', link_reuniao: item.link_reuniao || '', anotacoes_decisoes: parseAnotacoes(item.anotacoes_decisoes) });
    setSelecionado({ tema: item.tema, assunto: item.assunto });
    setConvidados([]);
    setConvidadosStatus({});
    const { data: convs } = await supabase.from('reuniao_convidados').select('convidado_cadastro, status').eq('reuniao_id', item.id);
    if (convs) {
      setConvidados(convs.map(c => c.convidado_cadastro));
      setConvidadosStatus(Object.fromEntries(convs.map(c => [c.convidado_cadastro, c.status])));
    }
  };

  const atualizarAnotacaoLinha = (idx, campo, valor) => {
    setForm(f => {
      const anotacoes_decisoes = [...f.anotacoes_decisoes];
      anotacoes_decisoes[idx] = { ...anotacoes_decisoes[idx], [campo]: valor };
      return { ...f, anotacoes_decisoes };
    });
  };

  const adicionarLinhaAnotacao = () => {
    setForm(f => ({ ...f, anotacoes_decisoes: [...f.anotacoes_decisoes, { tarefa: '', responsavel: '', prazo: '' }] }));
  };

  const removerLinhaAnotacao = (idx) => {
    setForm(f => ({ ...f, anotacoes_decisoes: f.anotacoes_decisoes.filter((_, i) => i !== idx) }));
  };

  const cancelarForm = () => {
    setModo(null);
    setEditandoId(null);
    setConvidados([]);
    setConvidadosStatus({});
    setForm({ tema: '', assunto: '', conteudo: '', fonte: '', local: '', data_reuniao: '', horario: '', tipo: 'presencial', link_reuniao: '', anotacoes_decisoes: [{ tarefa: '', responsavel: '', prazo: '' }] });
  };

  const toggleConvidado = (cadastro) => {
    setConvidados(cs => cs.includes(cadastro) ? cs.filter(c => c !== cadastro) : [...cs, cadastro]);
  };

  const [chamando, setChamando] = useState(false);
  const [chamado, setChamado] = useState(false);
  const chamarAgora = async () => {
    setChamando(true);
    const { error: err } = await supabase.from('atas_reuniao')
      .update({ chamada_em: new Date().toISOString() }).eq('id', editandoId);
    setChamando(false);
    if (err) { setError(err.message); return; }
    setChamado(true);
    setTimeout(() => setChamado(false), 4000);
  };

  const handleSalvar = async () => {
    if (!form.tema.trim() || !form.assunto.trim() || !stripHtml(form.conteudo)) {
      setError('Preencha tema, assunto e conteúdo');
      return;
    }

    setSalvando(true);
    try {
      const camposComuns = {
        tema: form.tema.trim(), assunto: form.assunto.trim(), conteudo: form.conteudo.trim(), fonte: form.fonte.trim(),
        local: form.local.trim(), data_reuniao: form.data_reuniao.trim(), horario: form.horario.trim(),
        tipo: form.tipo, link_reuniao: form.tipo === 'online' ? form.link_reuniao.trim() : null,
        anotacoes_decisoes: JSON.stringify(form.anotacoes_decisoes.filter(l => l.tarefa || l.responsavel || l.prazo))
      };

      let reuniaoId = editandoId;

      if (editandoId) {
        let payload = { ...camposComuns, updated_at: new Date() };
        let { data: linhasAlteradas, error: err } = await supabase.from('atas_reuniao').update(payload).eq('id', editandoId).select('id');
        if (err && /anotacoes_decisoes|tipo|link_reuniao/i.test(err.message)) {
          // Coluna ainda não criada no banco (falta rodar a migração correspondente) —
          // salva o resto normalmente em vez de bloquear a gravação.
          const { anotacoes_decisoes: _o1, tipo: _o2, link_reuniao: _o3, ...resto } = payload;
          ({ data: linhasAlteradas, error: err } = await supabase.from('atas_reuniao').update(resto).eq('id', editandoId).select('id'));
        }
        if (err) throw err;
        // O Supabase não retorna erro quando a política de segurança (RLS)
        // bloqueia a alteração silenciosamente — sem isso, nada é salvo e
        // nenhum aviso aparece. Detecta esse caso pela ausência de linhas.
        if (!linhasAlteradas || linhasAlteradas.length === 0) {
          throw new Error('Não foi possível salvar — você pode não ter permissão para editar esta reunião (foi criada por outro coordenador).');
        }
      } else {
        const qtd = formacao.filter(i => i.tema === form.tema.trim()).length;
        let payload = { ...camposComuns, ordem: qtd, created_by: user.id };
        let { data: nova, error: err } = await supabase.from('atas_reuniao').insert(payload).select('id').single();
        if (err && /anotacoes_decisoes|tipo|link_reuniao/i.test(err.message)) {
          const { anotacoes_decisoes: _o1, tipo: _o2, link_reuniao: _o3, ...resto } = payload;
          ({ data: nova, error: err } = await supabase.from('atas_reuniao').insert(resto).select('id').single());
        }
        if (err) throw err;
        reuniaoId = nova?.id;
      }

      // Sincroniza convidados (só faz sentido na reunião online)
      if (reuniaoId) {
        const alvo = form.tipo === 'online' ? convidados : [];
        const { data: atuais } = await supabase.from('reuniao_convidados').select('convidado_cadastro').eq('reuniao_id', reuniaoId);
        const jaTem = new Set((atuais || []).map(c => c.convidado_cadastro));
        const aRemover = [...jaTem].filter(c => !alvo.includes(c));
        const aInserir = alvo.filter(c => !jaTem.has(c));
        if (aRemover.length) {
          await supabase.from('reuniao_convidados').delete().eq('reuniao_id', reuniaoId).in('convidado_cadastro', aRemover);
        }
        if (aInserir.length) {
          await supabase.from('reuniao_convidados').insert(aInserir.map(c => ({ reuniao_id: reuniaoId, convidado_cadastro: c })));
        }
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
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
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

  // ---- Ata de Reunião (a partir dos dados já preenchidos na reunião em edição) ----
  const visualizarAta = () => {
    const item = formacao.find(i => i.id === editandoId);
    if (!item) { setError('Abra uma reunião para gerar a ata'); return; }
    setAtaVisualizando(item);
  };

  const fecharAta = () => setAtaVisualizando(null);

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
    const item = ataVisualizando;
    const infoReuniao = [item.local, item.data_reuniao, item.horario].filter(Boolean).join(' — ');
    const anotacoesTexto = parseAnotacoes(item.anotacoes_decisoes)
      .filter(l => l.tarefa || l.responsavel || l.prazo)
      .map(l => `- ${l.tarefa || '(sem tarefa)'} | Responsável: ${l.responsavel || '-'} | Prazo: ${l.prazo || '-'}`)
      .join('\n') || 'Nenhuma decisão registrada.';

    const texto = `*Ata de Reunião de Servidores do Altar*\n` +
      `${stripHtml(item.fonte || CONVITE_PADRAO)}\n\n` +
      `*Reunião:* ${item.tema}\n*Assunto:* ${item.assunto}\n*Local/Data/Horário:* ${infoReuniao || '-'}\n\n` +
      `*Ordem do dia*\n${stripHtml(item.conteudo)}\n\n` +
      `*Anotações das Decisões*\n${anotacoesTexto}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  // Botões de ação injetados na 1ª linha do cabeçalho do app, ao lado de
  // Sair — "Incluir" (+) sempre visível; Voltar/Salvar/Convite/Ata/Excluir
  // só aparecem com o formulário aberto.
  useEffect(() => {
    if (!setHeaderExtra) return;
    const itemAtual = formacao.find(i => i.id === editandoId);
    const btnStyle = (bg) => ({ display: 'flex', alignItems: 'center', gap: '0.3rem', background: bg, color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' });
    setHeaderExtra(
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        {modo && (
          <>
            <button type="button" onClick={cancelarForm} title="Voltar"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: '#94a3b8', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 6 }}>
              <img src="/icon-voltar.png" alt="Voltar" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </button>
            <button type="button" onClick={handleSalvar} disabled={salvando} style={btnStyle('#16a34a')}>
              {salvando ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Salvar
            </button>
            {editandoId && (
              <button type="button" onClick={() => setItemVisualizando(itemAtual)} style={btnStyle('#0ea5e9')}>
                <Eye size={14} /> Convite
              </button>
            )}
            <button type="button" onClick={visualizarAta} style={btnStyle('#ca8a04')}>
              <FileText size={14} /> Ata
            </button>
            {editandoId && (
              <button type="button" onClick={() => handleExcluir(editandoId)} style={btnStyle('#dc2626')}>
                <Trash2 size={14} /> Excluir
              </button>
            )}
          </>
        )}
        <button type="button" onClick={abrirInserirTema} title="Inserir Reunião"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: '#ca8a04', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          <Plus size={18} />
        </button>
      </div>
    );
    return () => setHeaderExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setHeaderExtra, modo, salvando, editandoId, formacao]);

  if (loading) return <div className="empty-state"><h3>Carregando...</h3></div>;

  const inputStyle = { width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1', borderRadius: 4, fontSize: '0.85rem' };

  return (
    <div className="grid-container" style={{ padding: 0 }}>
      <style>{`
        @media (max-width: 680px) {
          .ata-col-conteudo { display: none !important; }
          .ata-list-header th { font-size: 0.76rem !important; padding: 0.5rem 0.6rem !important; }
          .ata-list-header th:first-child button,
          .ata-list-header th:last-child button { font-size: 0.74rem !important; padding: 0.5rem 0.5rem !important; white-space: normal !important; }
          .ata-list td { padding: 0.4rem 0.6rem !important; font-size: 0.82rem !important; }

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
                  <td style={{ padding: '0.4rem 0.7rem', fontWeight: 700, color: '#1e293b' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                      {item.tipo === 'online' ? <Video size={13} /> : <MapPin size={13} />}{item.tema}
                    </span>
                  </td>
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
              <input type="text" placeholder="Reunião Nº" value={form.tema} onChange={e => setForm({ ...form, tema: e.target.value })} style={inputStyle} autoFocus={modo === 'tema'} />
            </div>
            <div className="ata-field-assunto">
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Assunto/Tema</label>
              <input type="text" placeholder="Assunto/Tema" value={form.assunto} onChange={e => setForm({ ...form, assunto: e.target.value })} style={inputStyle} autoFocus={modo === 'assunto'} />
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

          {/* ---- Tipo da reunião ---- */}
          <div style={{ marginBottom: '0.7rem' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>Tipo de reunião</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {[['presencial', 'Presencial', MapPin], ['online', 'Online', Video]].map(([val, txt, Ico]) => (
                <button key={val} type="button" onClick={() => setForm(f => ({ ...f, tipo: val }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem',
                    border: form.tipo === val ? '2px solid #ca8a04' : '1px solid #cbd5e1',
                    background: form.tipo === val ? '#fef9c3' : '#fff', color: '#1e293b' }}>
                  <Ico size={14} /> {txt}
                </button>
              ))}
            </div>
          </div>

          {form.tipo === 'online' && (
            <div style={{ marginBottom: '0.8rem', padding: '0.7rem', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.2rem' }}>Sala do Google Meet</label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <button type="button" onClick={() => window.open('https://meet.google.com/new', '_blank', 'noopener')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: '#0ea5e9', color: '#fff', border: 'none', padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}>
                  <Video size={14} /> Criar sala no Meet
                </button>
                <input type="url" placeholder="Cole aqui: https://meet.google.com/xxx-xxxx-xxx"
                  value={form.link_reuniao} onChange={e => setForm(f => ({ ...f, link_reuniao: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.6rem' }}>
                Abra o Meet, clique em "Nova reunião" → "Criar reunião para depois", copie o link e cole acima.
              </p>

              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.3rem' }}>
                Convidar ({convidados.length} selecionado{convidados.length === 1 ? '' : 's'}) — só quem tem cadastro
              </label>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 4 }}>
                {cadastrosDisponiveis.length === 0 && (
                  <p style={{ padding: '0.6rem', fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Nenhum servidor com cadastro nesta paróquia.</p>
                )}
                {cadastrosDisponiveis.map(({ cadastro, nome }) => {
                  const st = convidadosStatus[cadastro];
                  return (
                    <label key={cadastro} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.6rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', fontSize: '0.83rem' }}>
                      <input type="checkbox" checked={convidados.includes(cadastro)} onChange={() => toggleConvidado(cadastro)} />
                      <span style={{ flex: 1 }}>{cadastro} — {nome}</span>
                      {st && st !== 'pendente' && (
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: st === 'aceito' ? '#166534' : '#991b1b' }}>
                          {st === 'aceito' ? 'aceitou' : 'recusou'}
                        </span>
                      )}
                      {st === 'pendente' && <span style={{ fontSize: '0.7rem', color: '#854d0e' }}>pendente</span>}
                    </label>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.5rem 0 0' }}>
                Os convidados veem a reunião em "Minhas Reuniões". O link da sala só aparece para quem aceitar.
              </p>

              {editandoId && (
                <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px dashed #cbd5e1' }}>
                  <button type="button" onClick={chamarAgora} disabled={chamando || !form.link_reuniao.trim() || convidados.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: (chamando || !form.link_reuniao.trim() || convidados.length === 0) ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                    {chamando ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={14} />}
                    {chamado ? 'Chamada enviada!' : 'Chamar agora'}
                  </button>
                  <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0.35rem 0 0' }}>
                    Toca um alerta de "chamada" para os convidados que estiverem com o app aberto. Salve a reunião antes.
                  </p>
                </div>
              )}
            </div>
          )}

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
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1', padding: '0.25rem' }}>Tarefa</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1', padding: '0.25rem', width: '26%' }}>Responsável</th>
                  <th style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1', padding: '0.25rem', width: '18%' }}>Prazo</th>
                  <th style={{ width: '30px', borderBottom: '1px solid #cbd5e1' }}></th>
                </tr>
              </thead>
              <tbody>
                {form.anotacoes_decisoes.map((linha, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '0.25rem', borderBottom: '1px solid #e2e8f0' }}>
                      <input value={linha.tarefa} onChange={e => atualizarAnotacaoLinha(idx, 'tarefa', e.target.value)} style={inputStyle} />
                    </td>
                    <td style={{ padding: '0.25rem', borderBottom: '1px solid #e2e8f0' }}>
                      <input value={linha.responsavel} onChange={e => atualizarAnotacaoLinha(idx, 'responsavel', e.target.value)} style={inputStyle} />
                    </td>
                    <td style={{ padding: '0.25rem', borderBottom: '1px solid #e2e8f0' }}>
                      <input value={linha.prazo} onChange={e => atualizarAnotacaoLinha(idx, 'prazo', e.target.value)} style={inputStyle} />
                    </td>
                    <td style={{ padding: '0.25rem', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <button type="button" onClick={() => removerLinhaAnotacao(idx)}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, padding: '0.2rem 0.35rem', cursor: 'pointer' }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" onClick={adicionarLinhaAnotacao}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: '1px dashed #94a3b8', color: '#475569', padding: '0.3rem 0.6rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>
              <Plus size={12} /> Adicionar linha
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
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Convite</span>
              <button onClick={() => setItemVisualizando(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div ref={itemPreviewRef} style={{ padding: '1.4rem 1.6rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif' }}>
              <div style={{ fontSize: '0.98rem', lineHeight: 1.6, color: '#1e293b', margin: '0 0 1.1rem', fontStyle: 'italic', textAlign: 'justify' }}
                dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.fonte || CONVITE_PADRAO) }} />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '1rem' }}><tbody>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Reunião:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>
                    {itemVisualizando.tema}
                    {itemVisualizando.data_reuniao ? ` - Data ${fmtDataAbrev(itemVisualizando.data_reuniao)}` : ''}
                    {itemVisualizando.horario ? ` - Horário ${itemVisualizando.horario} horas` : ''}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Assunto:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>{itemVisualizando.assunto}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.2rem 0.5rem 0.2rem 0', fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap' }}>Local:</td>
                  <td style={{ padding: '0.2rem 0', color: '#334155' }}>{itemVisualizando.local || '-'}</td>
                </tr>
              </tbody></table>
              <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.3rem' }}>Ordem do dia:</p>
              <div style={{ fontSize: '0.92rem', lineHeight: 1.5, color: '#334155', margin: '0 0 1rem', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(itemVisualizando.conteudo) }} />
              {(() => {
                const linhas = parseAnotacoes(itemVisualizando.anotacoes_decisoes).filter(l => l.tarefa || l.responsavel || l.prazo);
                if (linhas.length === 0) return null;
                return (
                  <>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e293b', margin: '0 0 0.3rem' }}>Anotações das Decisões:</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}><tbody>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #94a3b8', padding: '0.15rem' }}>Tarefa</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #94a3b8', padding: '0.15rem', width: '28%' }}>Responsável</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #94a3b8', padding: '0.15rem', width: '18%' }}>Prazo</th>
                      </tr>
                      {linhas.map((l, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{l.tarefa || '-'}</td>
                          <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{l.responsavel || '-'}</td>
                          <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{l.prazo || '-'}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </>
                );
              })()}
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

      {/* ---- Modal de visualização da Ata de Reunião (somente leitura, antes de imprimir) ---- */}
      {ataVisualizando && (
        <div onClick={fecharAta}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '90%', maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar Ata de Reunião</span>
              <button onClick={fecharAta} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>

            <div ref={ataPreviewRef} style={{ padding: '0.9rem 1.2rem', overflowY: 'auto', background: '#fff', fontFamily: '"Times New Roman", Times, serif', lineHeight: 1.3 }}>
              {(() => {
                const secao = { marginBottom: '0.7rem', pageBreakInside: 'avoid' };
                const anotacoes = parseAnotacoes(ataVisualizando.anotacoes_decisoes).filter(l => l.tarefa || l.responsavel || l.prazo);
                return (
                  <>
                    {/* ---- CABEÇALHO ---- */}
                    <div style={{ textAlign: 'center', marginBottom: '0.7rem', borderBottom: '2px solid #1e293b', paddingBottom: '0.4rem' }}>
                      <h1 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.3rem' }}>
                        Ata de Reunião de Servidores do Altar
                      </h1>
                      <p style={{ fontSize: '0.85rem', color: '#334155', margin: 0 }}>
                        <strong>{ataVisualizando.tema}</strong> — {ataVisualizando.assunto}
                        <br />
                        {[ataVisualizando.local, ataVisualizando.data_reuniao, ataVisualizando.horario].filter(Boolean).join(' — ')}
                      </p>
                    </div>

                    {/* ---- CONVITE ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.2rem' }}>Convite de Participação</h2>
                      <p style={{ fontSize: '0.82rem', color: '#334155', textAlign: 'justify', fontStyle: 'italic', margin: 0 }}>
                        {stripHtml(ataVisualizando.fonte) || CONVITE_PADRAO}
                      </p>
                    </div>

                    {/* ---- ORDEM DO DIA ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.2rem' }}>Ordem do Dia</h2>
                      <div style={{ fontSize: '0.82rem', color: '#334155', textAlign: 'justify' }} dangerouslySetInnerHTML={{ __html: paraHtmlExibicao(ataVisualizando.conteudo) }} />
                    </div>

                    {/* ---- ANOTAÇÕES DAS DECISÕES ---- */}
                    <div style={secao}>
                      <h2 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.2rem' }}>Anotações das Decisões</h2>
                      {anotacoes.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem' }}>Tarefa</th>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem', width: '30%' }}>Responsável</th>
                              <th style={{ textAlign: 'left', borderBottom: '1px solid #1e293b', padding: '0.15rem', width: '20%' }}>Prazo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {anotacoes.map((linha, idx) => (
                              <tr key={idx}>
                                <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{linha.tarefa || '-'}</td>
                                <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{linha.responsavel || '-'}</td>
                                <td style={{ padding: '0.15rem', borderBottom: '1px solid #e2e8f0' }}>{linha.prazo || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0 }}>Nenhuma decisão registrada.</p>
                      )}
                    </div>

                    {/* ---- ASSINATURAS ---- */}
                    <div style={{ marginTop: '1.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', textAlign: 'center', pageBreakInside: 'avoid' }}>
                      <div>
                        <div style={{ borderBottom: '1px solid #1e293b', height: '1.4rem' }} />
                        <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>Coordenação</p>
                      </div>
                      <div>
                        <div style={{ borderBottom: '1px solid #1e293b', height: '1.4rem' }} />
                        <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' }}>Assessor Pastoral / Padre</p>
                      </div>
                      <div>
                        <div style={{ borderBottom: '1px solid #1e293b', height: '1.4rem' }} />
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
                <MessageCircle size={14} /> Enviar
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
