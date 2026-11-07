import React, { useState } from 'react';
import { HelpCircle, Search } from 'lucide-react';

// Conteúdo de ajuda de cada item do menu. A chave "name" tem que ser igual
// ao nome usado em menuOptions/activeMenu em App.jsx, para o filtro por
// papel funcionar sem duplicar a lista de permissões aqui.
const FAQ_SECOES = [
  {
    name: 'Agenda',
    titulo: 'Agenda',
    perguntas: [
      { p: 'O que encontro em Agenda?', r: 'A agenda de cada servidor (escalas, sacramentos, investidura) e a agenda de cada comunidade (dias e horários de missa/celebração ao longo do ano).' },
      { p: 'Como vejo a agenda de um servidor específico?', r: 'Entre em Agenda, escolha "Agenda do Servidor", localize o nome (ou número de cadastro) e toque para abrir.' },
      { p: 'Como envio a agenda pelo WhatsApp?', r: 'Dentro da visualização da agenda, toque em "Enviar por WhatsApp". No celular, só essa opção aparece (o PDF fica disponível no computador).' },
    ],
  },
  {
    name: 'Calendário',
    titulo: 'Calendário',
    perguntas: [
      { p: 'Para que serve o Calendário?', r: 'Mostra o calendário anual completo, com os dias em que cada comunidade tem missa/celebração já marcados, mês a mês.' },
      { p: 'Como troco de mês ou de ano?', r: 'Use as setas/seleção de ano no topo da tela. No celular, os meses aparecem um por vez para não ficar cortado.' },
    ],
  },
  {
    name: 'Coroinhas',
    titulo: 'Coroinhas',
    perguntas: [
      { p: 'Como cadastro um novo coroinha?', r: 'Toque em "Novo Coroinha", preencha os dados (nome, nascimento, responsáveis, sacramentos, comunidade que atua) e salve.' },
      { p: 'Como edito ou excluo um cadastro?', r: 'Na lista, toque no nome para abrir a ficha, ou use os ícones de editar/excluir no card (ou na tabela, no computador).' },
      { p: 'O que é "Card" e "Lista" no celular?', r: '"Card" mostra os dados principais de cada um; "Lista" mostra só número de cadastro e nome, ideal pra achar alguém rápido — toque no nome para ver a ficha completa.' },
    ],
  },
  {
    name: 'Acolitos',
    titulo: 'Acólitos',
    perguntas: [
      { p: 'O cadastro de Acólito é diferente do de Coroinha?', r: 'A tela é a mesma estrutura (dados pessoais, sacramentos, investidura, comunidade que atua), só muda a função selecionada.' },
    ],
  },
  {
    name: 'Monitores',
    titulo: 'Monitores',
    perguntas: [
      { p: 'O que diferencia o cadastro de Monitor?', r: 'Monitor não tem campos de responsável (pai/mãe), já que normalmente é um servidor adulto.' },
    ],
  },
  {
    name: 'Cerimoniários',
    titulo: 'Cerimoniários',
    perguntas: [
      { p: 'Como cadastro um Cerimoniário?', r: 'Mesma tela de cadastro dos demais servidores, com os campos de responsável disponíveis (caso seja menor de idade).' },
    ],
  },
  {
    name: 'Coordenadores',
    titulo: 'Coordenadores',
    perguntas: [
      { p: 'Como cadastro outro coordenador?', r: 'Em Coordenadores, toque em "Novo Coordenador". Esse cadastro cria um login próprio para a pessoa acessar o sistema.' },
    ],
  },
  {
    name: 'Comunidades',
    titulo: 'Comunidades',
    perguntas: [
      { p: 'Como cadastro uma comunidade/capela?', r: 'Toque em "Nova Comunidade", informe nome, endereço e a programação de missas/celebrações (dias, horários e frequência no mês).' },
      { p: 'Como vejo a programação de uma comunidade?', r: 'Toque no nome da comunidade na lista — abre a ficha com todos os horários cadastrados.' },
    ],
  },
  {
    name: 'Formação Cadastro',
    titulo: 'Formação — Cadastro',
    perguntas: [
      { p: 'Para que serve essa tela?', r: 'Para cadastrar os temas e conteúdos de formação que ficarão disponíveis para os servidores em "Formação e Estudos".' },
    ],
  },
  {
    name: 'Formação e Estudos',
    titulo: 'Formação e Estudos',
    perguntas: [
      { p: 'O que encontro aqui?', r: 'Os materiais de formação cadastrados pela coordenação: temas, assuntos e conteúdos de estudo.' },
    ],
  },
  {
    name: 'Reunião da Equipe',
    titulo: 'Reunião da Equipe',
    perguntas: [
      { p: 'Como marco uma reunião?', r: 'Toque em "Incluir", defina tema, assunto, data/horário, se é presencial ou online, e convide os servidores.' },
      { p: 'Como funciona a reunião online?', r: 'Ao marcar como online, você informa o link da sala; ele só aparece para o convidado depois que ele aceitar o convite.' },
    ],
  },
  {
    name: 'Reuniões',
    titulo: 'Reuniões',
    perguntas: [
      { p: 'O que aparece em Reuniões?', r: 'Os convites de reunião que você recebeu, com data, local/link e a opção de aceitar ou recusar.' },
      { p: 'Recebi um convite, como confirmo presença?', r: 'Abra o convite e toque em "Aceitar" ou "Recusar". Se for reunião online, o link só aparece depois que você aceitar.' },
    ],
  },
  {
    name: 'Caixa de Mensagens',
    titulo: 'Caixa de Mensagens',
    perguntas: [
      { p: 'Quem me envia mensagens?', r: 'A coordenação, pelas telas de cadastro (Coroinhas, Acólitos etc.), selecionando um ou mais servidores na Lista e tocando em "Enviar Mensagem".' },
      { p: 'Como sei que tem mensagem nova?', r: 'Um aviso aparece no topo da tela ao entrar, se houver mensagem não lida. A bolinha azul na caixa também indica mensagem não lida.' },
    ],
  },
  {
    name: 'Livro Caixa',
    titulo: 'Livro Caixa',
    perguntas: [
      { p: 'Para que serve o Livro Caixa?', r: 'Para registrar entradas e saídas (créditos e débitos) e acompanhar o saldo.' },
      { p: 'Como envio o extrato?', r: 'Abra o extrato e toque em "Enviar por WhatsApp" (no celular) ou "Baixar PDF" (no computador).' },
    ],
  },
  {
    name: 'Relatórios',
    titulo: 'Relatórios',
    perguntas: [
      { p: 'Que relatórios existem?', r: 'Aniversariantes, servidores, comunidades e por função — cada um com a visão correspondente.' },
      { p: 'Como troco de relatório no celular?', r: 'Use as abas/pílulas no topo da tela para escolher a visão; toque num card para abrir os detalhes.' },
    ],
  },
];

const corTitulo = { background: '#1e293b', color: '#fff' };

// Uma cor de fundo diferente por assunto, para as respostas ficarem fáceis
// de distinguir visualmente de uma seção para outra.
const PALETA_SECOES = [
  { titulo: '#dbeafe', titCor: '#1e3a8a', resposta: '#eff6ff' },
  { titulo: '#dcfce7', titCor: '#14532d', resposta: '#f0fdf4' },
  { titulo: '#fef3c7', titCor: '#78350f', resposta: '#fffbeb' },
  { titulo: '#ede9fe', titCor: '#4c1d95', resposta: '#f5f3ff' },
  { titulo: '#fce7f3', titCor: '#831843', resposta: '#fdf2f8' },
  { titulo: '#cffafe', titCor: '#164e63', resposta: '#ecfeff' },
  { titulo: '#ffe4e6', titCor: '#881337', resposta: '#fff1f2' },
];

export function AjudaModule({ ehCoordenador, menuOptions = [] }) {
  const [busca, setBusca] = useState('');

  const nomesPermitidos = new Set(menuOptions.map(m => m.name));
  const secoesPermitidas = FAQ_SECOES.filter(s => ehCoordenador || nomesPermitidos.has(s.name));

  const termo = busca.trim().toLowerCase();
  const secoes = !termo ? secoesPermitidas : secoesPermitidas
    .map(s => ({ ...s, perguntas: s.perguntas.filter(q => (q.p + ' ' + q.r).toLowerCase().includes(termo)) }))
    .filter(s => s.perguntas.length > 0);

  return (
    <div className="grid-container" style={{ padding: '0 0 2rem' }}>
      <div style={{ ...corTitulo, padding: '0.9rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <HelpCircle size={20} />
        <div>
          <div style={{ fontWeight: 700, fontSize: '1rem' }}>Ajuda</div>
          <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            {ehCoordenador ? 'Perguntas e respostas sobre todas as telas do sistema.' : 'Perguntas e respostas sobre as telas que você usa.'}
          </div>
        </div>
      </div>

      <div style={{ padding: '1rem 1.2rem 0' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar uma pergunta..."
            style={{ width: '100%', padding: '0.6rem 0.9rem 0.6rem 2.1rem', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: '0.88rem' }} />
        </div>
      </div>

      {secoes.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Nenhuma pergunta encontrada para "{busca}".</p>
      )}

      <div style={{ padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {secoes.map((s, si) => {
          const cor = PALETA_SECOES[si % PALETA_SECOES.length];
          return (
            <div key={s.name} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: cor.titulo, padding: '0.5rem 0.9rem', fontWeight: 700, fontSize: '0.88rem', color: cor.titCor }}>
                {s.titulo}
              </div>
              {s.perguntas.map((q, i) => (
                <details key={i} style={{ borderTop: '1px solid #e2e8f0', background: cor.resposta }}>
                  <summary style={{ padding: '0.65rem 0.9rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: cor.titCor }}>
                    {q.p}
                  </summary>
                  <p style={{ margin: 0, padding: '0 0.9rem 0.8rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>{q.r}</p>
                </details>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
