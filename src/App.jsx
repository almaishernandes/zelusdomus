import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase, supabaseAuthOnly } from './supabaseClient';
import { Plus, Search, Users, MapPin, CalendarDays, BookOpen, Clock, Church, UserCheck, Shield, UserPlus, Pencil, Trash2, PlusCircle, Eye, Printer, X, Download, Share2, HelpCircle, RotateCcw, ChevronRight, ChevronLeft, Sparkles, LogOut, FileText, Menu, Wallet, ClipboardList } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { LoginPage } from './LoginPage';
// Telas administrativas carregadas sob demanda: reduz o pacote inicial que o
// celular precisa baixar antes de mostrar a tela de login.
const FormacaoModule = React.lazy(() => import('./FormacaoModule').then(m => ({ default: m.FormacaoModule })));
const FormacaoAdminModule = React.lazy(() => import('./FormacaoAdminModule').then(m => ({ default: m.FormacaoAdminModule })));
const AtaReuniaoModule = React.lazy(() => import('./AtaReuniaoModule').then(m => ({ default: m.AtaReuniaoModule })));
const LivroCaixaModule = React.lazy(() => import('./LivroCaixaModule').then(m => ({ default: m.LivroCaixaModule })));
const RelatoriosModule = React.lazy(() => import('./RelatoriosModule').then(m => ({ default: m.RelatoriosModule })));
// html2pdf.js é pesado — carregado sob demanda apenas quando o usuário gera o PDF
const loadHtml2pdf = () => import('html2pdf.js').then(m => m.default);
import './index.css';

// Mock data
const MOCK_COROINHAS = [
  { id: 1, nome: 'Pedro Henrique', nascimento: '15/04/2012', telefone: '(11) 99999-8888', endereco: 'Rua A, 123', responsavel: 'Maria Silva', telefoneResponsavel: '(11) 98888-7777', comunidadeMora: 'Matriz São José', comunidadeAtua: 'Matriz São José' }
];

const MOCK_ACOLITOS = [
  { id: 1, nome: 'João Paulo Silva', nascimento: '10/02/2008', telefone: '(11) 98765-4321', endereco: 'Rua B, 456', responsavel: 'José Silva', telefoneResponsavel: '(11) 97777-6666', comunidadeMora: 'Matriz São José', comunidadeAtua: 'Matriz São José' }
];

const MOCK_MONITORES = [
  { id: 1, nome: 'Lucas de Moraes', nascimento: '25/08/2005', telefone: '(11) 97777-6666', endereco: 'Rua C, 789', responsavel: 'Carlos Moraes', telefoneResponsavel: '(11) 96666-5555', comunidadeMora: 'Comunidade Santo Antônio', comunidadeAtua: 'Comunidade Santo Antônio' }
];

const MOCK_CERIMONIARIOS = [
  { id: 1, nome: 'Ana Beatriz', nascimento: '12/05/2002', telefone: '(11) 95555-4444', endereco: 'Rua D, 101', responsavel: '', telefoneResponsavel: '', comunidadeMora: 'Matriz São José', comunidadeAtua: 'Matriz São José' }
];

const MOCK_COORDENADORES = [
  { id: 1, nome: 'Roberto Silva', nascimento: '30/11/1985', telefone: '(11) 94444-3333', endereco: 'Rua E, 202', responsavel: '', telefoneResponsavel: '', comunidadeMora: 'Capela N.S. Aparecida', comunidadeAtua: 'Matriz São José' }
];

const MOCK_COMUNIDADES = [
  { id: 1, nome: 'Matriz São José', endereco: 'Av. Principal, 1000 - Centro', seg: '', ter: '', qua: '', qui: '', sex: '', sab: '', dom: '07:30, 09:00, 19:00' },
  { id: 2, nome: 'Capela N.S. Aparecida', endereco: 'Rua das Flores, 200 - Bairro Alto', seg: '', ter: '', qua: '', qui: '', sex: '', sab: '19:00', dom: '10:00' },
  { id: 3, nome: 'Comunidade Santo Antônio', endereco: 'Rua do Bosque, 50 - Vila Nova', seg: '', ter: '', qua: '', qui: '', sex: '', sab: '18:00', dom: '08:30' }
];

const ROLE_COLORS = {
  'Coroinha':    { bg: '#9b2226', color: '#ffffff', spanColor: '#fef2f2' },
  'Acólito':     { bg: '#0a0a0a', color: '#ffffff', spanColor: '#e5e5e5' },
  'Monitor':     { bg: '#e65c00', color: '#ffffff', spanColor: '#fff3e0' },
  'Cerimoniário':{ bg: '#1d4ed8', color: '#ffffff', spanColor: '#eff6ff' },
  'Coordenador': { bg: '#15803d', color: '#ffffff', spanColor: '#f0fdf4' }
};

const MENU_COLORS = {
  'Coroinhas':              ROLE_COLORS['Coroinha'],
  'Acolitos':               ROLE_COLORS['Acólito'],
  'Monitores':              ROLE_COLORS['Monitor'],
  'Cerimoniários':          ROLE_COLORS['Cerimoniário'],
  'Coordenadores':          ROLE_COLORS['Coordenador'],
  'Comunidades':            { bg: '#7c3aed', color: '#ffffff', spanColor: '#f5f3ff' },
  'Agenda e Calendário':    { bg: '#ffffff', color: '#1e293b', spanColor: '#f1f5f9' },
  'Formação Cadastro':      { bg: '#0ea5e9', color: '#ffffff', spanColor: '#e0f2fe' },
  'Ata de Reunião':         { bg: '#ca8a04', color: '#ffffff', spanColor: '#fef9c3' },
  'Livro Caixa':            { bg: '#16a34a', color: '#ffffff', spanColor: '#dcfce7' },
  'Relatórios':             { bg: '#0f766e', color: '#ffffff', spanColor: '#ccfbf1' },
  'Formação e Estudos':     { bg: '#ffffff', color: '#1e293b', spanColor: '#f1f5f9' },
};

function AppContent() {
  const { eAutenticado, ehCoordenador, ehServidor, perfil, user, logout, loading: authLoading } = useAuth();

  // TODOS os Hooks AQUI, ANTES de qualquer if/return
  const [activeMenu, setActiveMenu] = useState('Coroinhas');
  // Ações extras que uma tela (ex: CadastroServidorForm) injeta na primeira
  // linha do cabeçalho, ao lado do usuário/Sair — evita uma segunda linha de botões.
  const [headerExtra, setHeaderExtra] = useState(null);
  useEffect(() => { if (!['CadastroServidor', 'Livro Caixa', 'Relatórios', 'Ata de Reunião'].includes(activeMenu)) setHeaderExtra(null); }, [activeMenu]);
  const [dbServers, setDbServers] = useState([]);
  const [dbCommunities, setDbCommunities] = useState([]);
  const [prevMenu, setPrevMenu] = useState('Coroinhas');
  const [editingServer, setEditingServer] = useState(null);
  const [editingCommunity, setEditingCommunity] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [menuAberto, setMenuAberto] = useState(false);

  const fetchAll = React.useCallback(async () => {
    const [{ data: servers }, { data: communities }] = await Promise.all([
      supabase.from('servers').select('*').order('full_name'),
      supabase.from('communities').select('*').order('name')
    ]);
    if (servers) setDbServers(servers);
    if (communities) setDbCommunities(communities);
  }, []);

  // Só busca servidores/comunidades depois que o login for confirmado — evita
  // competir por rede com a própria autenticação enquanto a tela de login carrega
  // (crítico em conexões móveis mais lentas).
  useEffect(() => { if (eAutenticado) fetchAll(); }, [eAutenticado, fetchAll]);

  // Celular: acesso restrito a Agenda e Calendário / Formação e Estudos,
  // mesmo para coordenadores (o acesso completo é sempre pelo desktop).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const MENUS_PERMITIDOS_MOBILE = ['Agenda e Calendário', 'Formação e Estudos'];

  // Coroinha/Acólito (nível restrito) começam direto na Agenda e Calendário —
  // o activeMenu inicial ('Coroinhas') é uma tela de coordenador e não deve
  // "vazar" para quem só tem acesso aos 2 menus liberados.
  useEffect(() => {
    if (!eAutenticado || authLoading) return;
    const NIVEL_AMPLO_CHECK = ['monitor', 'cerimoniario'];
    const amplo = (perfil?.funcoes || []).some(f => NIVEL_AMPLO_CHECK.includes(f));
    const permitido = ehCoordenador
      ? true
      : amplo
        ? !['Formação Cadastro', 'Livro Caixa'].includes(activeMenu)
        : MENUS_PERMITIDOS_MOBILE.includes(activeMenu);
    if (!permitido && !['CadastroServidor', 'CadastroComunidade'].includes(activeMenu)) {
      setActiveMenu('Agenda e Calendário');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eAutenticado, authLoading, ehCoordenador, perfil, activeMenu]);

  console.log('[APP] Estado:', { eAutenticado, authLoading, perfil });

  // Agora SIM, renderizações condicionais
  if (!eAutenticado) {
    return <LoginPage />;
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', padding: '1.5rem' }}>
        <div style={{ maxWidth: 360, textAlign: 'center', color: '#f1f5f9' }}>
          <div style={{ width: 44, height: 44, margin: '0 auto 1.2rem', border: '3px solid rgba(241,245,249,0.25)', borderTopColor: '#f1f5f9', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
          <p style={{ fontSize: '0.85rem', margin: '0 0 1rem', color: '#93c5fd' }}>Enquanto aguardamos, rezemos juntos:</p>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#93c5fd', margin: '0 0 0.8rem' }}>Ave Maria</p>
          <p style={{ fontSize: '0.95rem', lineHeight: 1.7, margin: 0, color: '#e2e8f0' }}>
            Cheia de graça,<br />
            o Senhor é convosco.<br />
            Bendita sois vós entre as mulheres<br />
            e bendito é o fruto do vosso ventre, Jesus.<br />
            Santa Maria,<br />
            Amém.
          </p>
        </div>
      </div>
    );
  }

  const MENU_NOVO = {
    'Coroinhas':     { label: 'Cadastrar Novo Coroinha',     target: 'CadastroServidor' },
    'Acolitos':      { label: 'Cadastrar Novo Acólito',      target: 'CadastroServidor' },
    'Monitores':     { label: 'Cadastrar Novo Monitor',      target: 'CadastroServidor' },
    'Cerimoniários': { label: 'Cadastrar Novo Cerimoniário', target: 'CadastroServidor' },
    'Coordenadores': { label: 'Cadastrar Novo Coordenador',  target: 'CadastroServidor' },
    'Comunidades':   { label: 'Cadastrar Nova Comunidade',   target: 'CadastroComunidade' },
  };

  const handleDeleteServer = async (id) => {
    if (!window.confirm('Excluir este servidor?')) return;
    // Get person_id first so we can delete all roles of this person
    const { data: rec } = await supabase.from('servers').select('person_id').eq('id', id).single();
    if (rec?.person_id) {
      await supabase.from('servers').delete().eq('person_id', rec.person_id);
    } else {
      await supabase.from('servers').delete().eq('id', id);
    }
    fetchAll();
  };

  const handleDeleteCommunity = async (id) => {
    if (!window.confirm('Excluir esta comunidade?')) return;
    await supabase.from('communities').delete().eq('id', id);
    fetchAll();
  };

  const handleEditServer = (item) => {
    setEditingServer(item);
    setPrevMenu(activeMenu);
    setActiveMenu('CadastroServidor');
  };

  const handleEditCommunity = (item) => {
    setEditingCommunity(item);
    setPrevMenu(activeMenu);
    setActiveMenu('CadastroComunidade');
  };


  // Monitor/Cerimoniário (e Coordenador) têm acesso amplo; Coroinha/Acólito
  // continuam restritos só a Agenda e Formação e Estudos.
  const NIVEL_AMPLO = ['monitor', 'cerimoniario', 'coordenador'];
  const acessoAmplo = ehCoordenador || (perfil?.funcoes || []).some(f => NIVEL_AMPLO.includes(f));

  const menuOptionsCompleto = [
    { name: 'Coroinhas',              icon: Users },
    { name: 'Acolitos',               icon: Shield },
    { name: 'Monitores',              icon: UserCheck },
    { name: 'Cerimoniários',          icon: Users },
    { name: 'Coordenadores',          icon: Shield },
    { name: 'Comunidades',            icon: Church },
    { name: 'Agenda e Calendário',    icon: CalendarDays },
    { name: 'Formação Cadastro',      icon: BookOpen },
    { name: 'Formação e Estudos',     icon: BookOpen },
    { name: 'Ata de Reunião',         icon: FileText },
    { name: 'Livro Caixa',            icon: Wallet },
    { name: 'Relatórios',             icon: ClipboardList }
  ];
  const menuOptionsRestrito = [
    { name: 'Agenda e Calendário',    icon: CalendarDays },
    { name: 'Formação e Estudos',     icon: BookOpen }
  ];

  const menuOptions = ehCoordenador
    ? menuOptionsCompleto
    : acessoAmplo
      ? menuOptionsCompleto.filter(m => !['Formação Cadastro', 'Livro Caixa'].includes(m.name))
      : menuOptionsRestrito;


  const renderContent = () => {
    switch(activeMenu) {
      case 'CadastroServidor':
        return <CadastroServidorForm
          onBack={() => { setEditingServer(null); setActiveMenu(prevMenu); }}
          onSaved={() => { setEditingServer(null); fetchAll(); setActiveMenu(prevMenu); }}
          editData={editingServer}
          communities={dbCommunities}
          initialType={prevMenu}
          setHeaderExtra={setHeaderExtra}
        />;
      case 'CadastroComunidade':
        return <CadastroComunidadeForm
          onBack={() => { setEditingCommunity(null); setActiveMenu(prevMenu); }}
          onSaved={() => { setEditingCommunity(null); fetchAll(); setActiveMenu(prevMenu); }}
          editData={editingCommunity}
        />;
      case 'Coroinhas':
        return <ServidoresTable data={dbServers.filter(s => s.type === 'coroinha')} title="Coroinhas" onDelete={handleDeleteServer} onEdit={handleEditServer} communities={dbCommunities} onNew={() => { setPrevMenu('Coroinhas'); setActiveMenu('CadastroServidor'); }} />;
      case 'Acolitos':
        return <ServidoresTable data={dbServers.filter(s => s.type === 'acolito')} title="Acólitos" onDelete={handleDeleteServer} onEdit={handleEditServer} communities={dbCommunities} onNew={() => { setPrevMenu('Acolitos'); setActiveMenu('CadastroServidor'); }} />;
      case 'Monitores':
        return <ServidoresTable data={dbServers.filter(s => s.type === 'monitor')} title="Monitores" onDelete={handleDeleteServer} onEdit={handleEditServer} communities={dbCommunities} onNew={() => { setPrevMenu('Monitores'); setActiveMenu('CadastroServidor'); }} />;
      case 'Cerimoniários':
        return <ServidoresTable data={dbServers.filter(s => s.type === 'cerimoniario')} title="Cerimoniários" onDelete={handleDeleteServer} onEdit={handleEditServer} communities={dbCommunities} onNew={() => { setPrevMenu('Cerimoniários'); setActiveMenu('CadastroServidor'); }} />;
      case 'Coordenadores':
        return <ServidoresTable data={dbServers.filter(s => s.type === 'coordenador')} title="Coordenadores" onDelete={handleDeleteServer} onEdit={handleEditServer} communities={dbCommunities} onNew={() => { setPrevMenu('Coordenadores'); setActiveMenu('CadastroServidor'); }} />;
      case 'Comunidades':
        return <ComunidadesTable data={dbCommunities} onDelete={handleDeleteCommunity} onEdit={handleEditCommunity} onNew={() => { setPrevMenu('Comunidades'); setActiveMenu('CadastroComunidade'); }} />;
      case 'Agenda e Calendário':
        return <AgendaModule servers={dbServers} communities={dbCommunities} isMobile={isMobile}
          restrictCadastro={(!ehCoordenador && !acessoAmplo) ? perfil?.numero_cadastro : null} />;
      case 'Formação Cadastro':
        return <FormacaoAdminModule communities={dbCommunities} />;
      case 'Ata de Reunião':
        return <AtaReuniaoModule communities={dbCommunities} setHeaderExtra={setHeaderExtra} />;
      case 'Livro Caixa':
        return <LivroCaixaModule setHeaderExtra={setHeaderExtra} />;
      case 'Relatórios':
        return <RelatoriosModule servers={dbServers} communities={dbCommunities} setHeaderExtra={setHeaderExtra} />;
      case 'Formação e Estudos':
        return <FormacaoModule isMobile={isMobile} />;
      default:
        return null;
    }
  };

  const novoBtn = MENU_NOVO[activeMenu] && !['CadastroServidor','CadastroComunidade'].includes(activeMenu) ? MENU_NOVO[activeMenu] : null;
  const novoBtnColor = MENU_COLORS[activeMenu] || null;

  return (
    <div className="app-container">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button className="menu-toggle" onClick={() => setMenuAberto(m => !m)}
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#1e293b', padding: '0.3rem' }}
            aria-label="Abrir menu">
            <Menu size={24} />
          </button>
          <h1 style={{ minWidth: '250px' }}>
            <Users size={28} />
            ZelusDomus
          </h1>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            {perfil && <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {ehCoordenador
                ? `👤 ${perfil.full_name} — Coordenador`
                : `👤 ${perfil.full_name} — ${(perfil.funcoes && perfil.funcoes.length) ? perfil.funcoes.map(t => TYPE_LABELS[t] || t).join(', ') : 'Servidor do Altar'}`}
              {user?.email ? ` — ${user.email}` : ''}
            </span>}
            <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#dc2626', border: 'none', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}>
              <LogOut size={16} /> Sair
            </button>
            {headerExtra}
          </div>
          {novoBtn && (() => {
            const btnBg = novoBtnColor ? novoBtnColor.bg : '#b34946';
            const btnColor = novoBtnColor ? novoBtnColor.color : '#ffffff';
            return (
              <button
                onClick={() => { setPrevMenu(activeMenu); setActiveMenu(novoBtn.target); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: btnBg, border: '1.5px solid rgba(255,255,255,0.6)',
                  color: btnColor, fontWeight: 700, fontSize: '0.85rem',
                  padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer',
                  transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                onMouseOver={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.03)'; }}
                onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <PlusCircle size={16} />
                {novoBtn.label}
              </button>
            );
          })()}
        </div>
      </header>

      <div className="app-layout">
        {isMobile && menuAberto && (
          <div className="sidebar-overlay" onClick={() => setMenuAberto(false)} />
        )}
        <aside className={`sidebar ${isMobile && menuAberto ? 'sidebar-open' : ''}`}>
          <ul className="menu-list" style={{ padding: 0 }}>
            {menuOptions.map(option => {
              const Icon = option.icon;
              const menuColor = MENU_COLORS[option.name];
              const isActive = activeMenu === option.name;

              const customStyle = menuColor ? {
                background: menuColor.bg,
                color: menuColor.color,
                opacity: isActive ? 1 : 0.7,
                fontWeight: isActive ? 700 : 500,
                borderLeft: isActive ? `4px solid ${menuColor.color}` : '4px solid transparent',
                marginBottom: '1px'
              } : {};

              return (
                <li
                  key={option.name}
                  className={`menu-item ${isActive && !menuColor ? 'active' : ''}`}
                  onClick={() => { setActiveMenu(option.name); setMenuAberto(false); }}
                  style={customStyle}
                >
                  <Icon size={20} />
                  {option.name}
                </li>
              );
            })}
          </ul>
        </aside>

        <main className="main-content">
          <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Carregando...</div>}>
            {renderContent()}
          </React.Suspense>
        </main>
      </div>
    </div>
  );
}

const openMap = (addr) => {
  if (addr && addr !== '-') window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`, '_blank');
};

const parseAddress = (address) => {
  if (!address || address === '-') return { streetNum: address, bairro: '' };
  const parts = address.split(' - ');
  // Formato novo: "Rua X - Nº Y - Bairro, Cidade - UF"
  if (parts[1]?.startsWith('Nº')) {
    return {
      streetNum: `${parts[0]?.trim()}, ${parts[1]?.trim()}`,
      bairro: parts.slice(2, parts.length - 1).join(', ').trim() || parts[parts.length - 1]?.trim() || '',
    };
  }
  // Formato antigo: "Rua X, Bairro, Cidade - UF"
  const commaParts = parts[0].split(',');
  return {
    streetNum: commaParts[0]?.trim() || parts[0],
    bairro: commaParts[1]?.trim() || parts[1]?.trim() || '',
  };
};

const AddressLink = ({ address, showOnly }) => {
  if (!address || address === '-') return <span>-</span>;
  const { streetNum, bairro } = parseAddress(address);
  const display = showOnly === 'bairro' ? bairro : streetNum;
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); openMap(address); }}
      title="Ver no Google Maps"
      style={{ color: '#2563eb', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}
      onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
    >
      <MapPin size={14} />
      {display}
    </a>
  );
};

const COMMUNITY_PALETTE = [
  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' }, // azul
  { bg: '#dcfce7', color: '#15803d', border: '#86efac' }, // verde
  { bg: '#fef9c3', color: '#854d0e', border: '#fde047' }, // amarelo
  { bg: '#fce7f3', color: '#9d174d', border: '#f9a8d4' }, // rosa
  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' }, // roxo
  { bg: '#ffedd5', color: '#9a3412', border: '#fdba74' }, // laranja
  { bg: '#ccfbf1', color: '#0f766e', border: '#5eead4' }, // teal
  { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' }, // vermelho
];
const communityColorCache = {};
let communityColorIdx = 0;
const getCommunityColor = (name) => {
  if (!name) return null;
  if (!communityColorCache[name]) {
    communityColorCache[name] = COMMUNITY_PALETTE[communityColorIdx % COMMUNITY_PALETTE.length];
    communityColorIdx++;
  }
  return communityColorCache[name];
};

const WhatsAppLink = ({ phone }) => {
  if (!phone) return <span>-</span>;
  const digits = phone.replace(/\D/g, '');
  const number = digits.length === 11 ? `55${digits}` : digits.length === 13 ? digits : `55${digits}`;
  return (
    <a href={`https://wa.me/${number}`} target="_blank" rel="noreferrer"
      title="Abrir conversa no WhatsApp"
      style={{ color: '#15803d', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}
      onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
      onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#15803d"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      {phone}
    </a>
  );
};

// Célula de linha única: corta o conteúdo que não cabe e mostra um "+" que abre o restante.
// Tab, Enter ou Esc fecham o painel expandido.
function ClampCell({ maxWidth, children, full, tdStyle = {} }) {
  const innerRef = useRef(null);
  const popRef = useRef(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const check = () => setClipped(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  useEffect(() => {
    if (open && popRef.current) popRef.current.focus();
  }, [open]);

  return (
    <td style={{ ...tdStyle, position: 'relative', maxWidth, whiteSpace: 'nowrap', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', minWidth: 0 }}>
        <div ref={innerRef} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {children}
        </div>
        {clipped && (
          <button
            title="Ver conteúdo completo"
            onClick={() => setOpen(o => !o)}
            style={{ flex: 'none', width: 18, height: 18, lineHeight: '16px', padding: 0, textAlign: 'center',
              background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 4,
              cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem' }}
          >+</button>
        )}
      </div>
      {open && (
        <div
          ref={popRef}
          tabIndex={-1}
          onKeyDown={e => {
            if (e.key === 'Tab' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setOpen(false); }
          }}
          onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}
          style={{ position: 'absolute', top: 'calc(100% - 4px)', left: 0, zIndex: 40,
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)', padding: '0.6rem 0.8rem',
            minWidth: '100%', width: 'max-content', maxWidth: 420,
            whiteSpace: 'normal', overflowWrap: 'break-word', outline: 'none', fontSize: '0.85rem' }}
        >
          {full !== undefined ? full : children}
        </div>
      )}
    </td>
  );
}

// Ficha completa do cadastro em formato de formulário para impressão (PDF via imprimir do navegador).
// Mostra todos os campos: os preenchidos com os dados e os demais em branco.
const TYPE_LABELS = { coroinha: 'Coroinha', acolito: 'Acólito', monitor: 'Monitor', cerimoniario: 'Cerimoniário', coordenador: 'Coordenador' };
const SACR_PRINT = [['batismo', 'Batismo'], ['primeira_eucaristia', 'Eucaristia'], ['crisma', 'Crisma'], ['matrimonio', 'Matrimônio']];
const INV_PRINT = [['coroinha', 'Coroinha'], ['acolito', 'Acólito']];

// Monta as linhas de missa (evento, semana, dia, horário) a partir do mass_schedules da comunidade
const FICHA_DOW_ORDER = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const FICHA_FREQ_MAP = { '1ª': 1, '2ª': 2, '3ª': 3, '4ª': 4, '5ª': 5, '1ª semana': 1, '2ª semana': 2, '3ª semana': 3, '4ª semana': 4, '5ª semana': 5 };
function buildMassRows(ms) {
  if (!ms || Array.isArray(ms)) return [];
  const result = [];
  Object.entries(ms).forEach(([eventName, schedule]) => {
    const horarios = schedule.horarios || schedule;
    const freq = schedule.frequencia || schedule.frequency;
    const nths = (!freq || freq.length === 0) ? [1, 2, 3, 4, 5] : freq.map(f => FICHA_FREQ_MAP[f]).filter(Boolean);
    FICHA_DOW_ORDER.forEach(dow => {
      const rawTime = horarios[dow];
      if (!rawTime || typeof rawTime !== 'string') return;
      const times = rawTime.split(',').map(t => t.trim().replace(';', ':')).filter(Boolean).sort();
      nths.forEach(nth => times.forEach(time => result.push({ eventName, nth, dow, time })));
    });
  });
  // Exibição da ficha: ordem semanal de SEG a DOM; dentro do mesmo dia, por semana e horário
  const DOW_DISPLAY = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
  result.sort((a, b) => DOW_DISPLAY.indexOf(a.dow) - DOW_DISPLAY.indexOf(b.dow)
    || a.nth - b.nth
    || a.time.localeCompare(b.time));
  return result;
}

function FichaCadastro({ item, communities = [], onClose }) {
  const [sacr, setSacr] = useState({});
  const [inv, setInv] = useState({});
  const [tipos, setTipos] = useState([item.type].filter(Boolean));

  useEffect(() => {
    let active = true;
    (async () => {
      const [sacRes, invRes, sibRes] = await Promise.all([
        supabase.from('server_sacraments').select('*').eq('server_id', item.id),
        supabase.from('server_investitures').select('*').eq('server_id', item.id),
        item.person_id
          ? supabase.from('servers').select('type').eq('person_id', item.person_id)
          : Promise.resolve({ data: null })
      ]);
      if (!active) return;
      const s = {}; (sacRes.data || []).forEach(r => { if (r.type) s[r.type] = r; });
      const i = {}; (invRes.data || []).forEach(r => { if (r.type) i[r.type] = r; });
      setSacr(s); setInv(i);
      if (sibRes.data) setTipos([...new Set(sibRes.data.map(r => r.type).filter(Boolean))]);
    })();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { active = false; window.removeEventListener('keydown', onKey); };
  }, [item, onClose]);

  const fmtDate = (iso) => iso ? iso.slice(0, 10).split('-').reverse().join('/') : '';
  let guardians = { mae: { nome: '', phone: '' }, pai: { nome: '', phone: '' }, outro: { nome: '', phone: '' } };
  try { const p = JSON.parse(item.guardian_name || 'null'); if (p && typeof p === 'object' && p.mae) guardians = p; }
  catch { guardians.mae = { nome: item.guardian_name || '', phone: item.guardian_phone || '' }; }
  let atua = [];
  try { atua = JSON.parse(item.community_atua || '[]'); } catch { /* formato legado */ }
  let part = {};
  try { const p = JSON.parse(item.participation || '{}'); if (p && typeof p === 'object') part = p; } catch { /* sem participação */ }
  const nthSuf = (nth, dow) => `${nth}${(dow === 'DOM' || dow === 'SAB') ? 'º' : 'ª'}`;

  // Exportação da ficha em PDF (html2pdf.js, carregado sob demanda).
  // Em celulares compatíveis (Web Share API com arquivos), o compartilhamento
  // nativo envia o PDF direto para o WhatsApp/e-mail em um único passo.
  const nomeServ = item.full_name || item.nome || 'servidor';
  const pdfFilename = `Ficha-Cadastro-${item.cadastro || 'sn'}-${nomeServ.trim().replace(/\s+/g, '-')}.pdf`;
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const podeCompartilharArquivo = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([new Blob()], 'f.pdf', { type: 'application/pdf' })] });

  const pdfOptions = () => ({
    margin: [8, 8],
    filename: pdfFilename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, ignoreElements: (el) => !!el.classList && el.classList.contains('no-print') },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  });

  const gerarBaixarPdf = async () => {
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      await html2pdf().set(pdfOptions()).from(document.getElementById('ficha-print')).save();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  };

  // Envio pelo WhatsApp: compartilhamento nativo (sem gravar arquivo) com o PDF
  // anexado e a mensagem junto. Onde o navegador não suporta anexar (computador),
  // baixa o PDF e abre a conversa com a mensagem pronta.
  const enviarWhatsApp = async () => {
    const msg = [
      'Olá, Servidor do Altar... 👋',
      '',
      'Segue em anexo a sua *Ficha de Cadastro*.',
      'Por favor, preencha os dados que estão faltando e nos devolva para atualizar o cadastro no app *Zelus Domus*.',
      '',
      'Que Deus abençoe sempre você, Servidor do Altar. 🙏'
    ].join('\n');
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      const worker = html2pdf().set(pdfOptions()).from(document.getElementById('ficha-print'));
      if (podeCompartilharArquivo) {
        const blob = await worker.outputPdf('blob');
        const file = new File([blob], pdfFilename, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: 'Ficha de Cadastro', text: msg });
      } else {
        await worker.save();
        const digits = (item.phone || item.telefone || '').replace(/\D/g, '');
        const dest = digits ? (digits.length === 11 ? `55${digits}` : digits) : '';
        window.open(`https://wa.me/${dest}?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Erro ao enviar pelo WhatsApp:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  const compartilharNativo = async () => {
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      const blob = await html2pdf().set(pdfOptions()).from(document.getElementById('ficha-print')).outputPdf('blob');
      const file = new File([blob], pdfFilename, { type: 'application/pdf' });
      await navigator.share({
        files: [file],
        title: 'Ficha de Cadastro',
        text: `Ficha de Cadastro de ${nomeServ} — ZelusDomus / Servidores do Altar`
      });
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Erro ao compartilhar:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  const cell = { border: '1px solid #444', padding: '0.35rem 0.5rem', fontSize: '0.85rem', verticalAlign: 'top' };
  const lbl = { ...cell, background: '#eef2ff', fontWeight: 700, whiteSpace: 'nowrap', width: '1%' };
  const tbl = { width: '100%', borderCollapse: 'collapse', marginBottom: '0.7rem' };
  const chk = (on) => <span style={{ fontSize: '1rem', lineHeight: 1 }}>{on ? '☑' : '☐'}</span>;
  const secTitle = (t) => <div style={{ fontWeight: 700, fontSize: '0.85rem', margin: '0.2rem 0 0.3rem', color: '#1e3a8a' }}>{t}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 100, overflow: 'auto', padding: '1.5rem' }} onClick={onClose}>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #ficha-print, #ficha-print * { visibility: visible !important; }
        #ficha-print { position: absolute !important; left: 0; top: 0; width: 100% !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
        .no-print { display: none !important; }
      }`}</style>
      <div id="ficha-print" onClick={e => e.stopPropagation()}
        style={{ background: '#fff', maxWidth: 820, margin: '0 auto', borderRadius: 8, boxShadow: '0 12px 40px rgba(0,0,0,0.35)', padding: '1.2rem 1.4rem', color: '#111' }}>

        <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.8rem' }}>
          <button onClick={gerarBaixarPdf} disabled={gerandoPdf} title="Gera o arquivo PDF da ficha e baixa no computador"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem', opacity: gerandoPdf ? 0.7 : 1 }}>
            <Download size={15} /> {gerandoPdf ? 'Gerando…' : 'Gerar e Baixar PDF'}
          </button>
          <button onClick={enviarWhatsApp} disabled={gerandoPdf} title="Baixa o PDF da ficha e abre o WhatsApp com a mensagem pronta — anexe o arquivo e envie"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#15803d', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Enviar por WhatsApp
          </button>
          {podeCompartilharArquivo && (
            <button onClick={compartilharNativo} disabled={gerandoPdf} title="Compartilhar o PDF direto pelo celular (WhatsApp, e-mail, etc.)"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#0f766e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Share2 size={15} /> Compartilhar PDF
            </button>
          )}
          <button onClick={() => window.print()} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={onClose} title="Fechar (Esc)"
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.6rem', display: 'inline-flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '0.4rem', marginBottom: '0.7rem' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e3a8a' }}>ZelusDomus — Ficha de Cadastro</div>
            <div style={{ fontSize: '0.8rem', color: '#475569' }}>Servidores do Altar</div>
          </div>
          <div style={{ border: '2px solid #1e3a8a', borderRadius: 6, padding: '0.3rem 0.8rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569' }}>CADASTRO Nº</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{item.cadastro || ' '}</div>
          </div>
        </div>

        <table style={tbl}><tbody>
          <tr>
            <td style={lbl}>Nome</td>
            <td style={{ ...cell, width: '55%' }}>{item.full_name || item.nome || ' '}</td>
            <td style={lbl}>Nascimento</td>
            <td style={{ ...cell, width: '20%' }}>{fmtDate(item.dob) || item.nascimento || ' '}</td>
          </tr>
          <tr>
            <td style={lbl}>E-mail de acesso</td>
            <td style={{ ...cell, width: '55%' }}>{item.email || ' '}</td>
            <td style={lbl}>WhatsApp</td>
            <td style={{ ...cell, width: '20%' }}>{item.phone || item.telefone || ' '}</td>
          </tr>
          <tr>
            <td style={lbl}>Residência</td>
            <td style={cell} colSpan={3}>{item.address || item.endereco || ' '}</td>
          </tr>
        </tbody></table>

        {secTitle('Responsáveis')}
        <table style={tbl}><tbody>
          {[['Mãe', guardians.mae], ['Pai', guardians.pai], ['Outro', guardians.outro]].map(([t, g]) => (
            <tr key={t}>
              <td style={lbl}>{t}</td>
              <td style={cell}>{g?.nome || ' '}</td>
              <td style={lbl}>WhatsApp</td>
              <td style={{ ...cell, width: '28%' }}>{g?.phone || ' '}</td>
            </tr>
          ))}
        </tbody></table>

        {secTitle('Função que exerce')}
        <table style={tbl}><tbody><tr>
          {Object.entries(TYPE_LABELS).map(([k, label]) => (
            <td key={k} style={{ ...cell, textAlign: 'center' }}>{chk(tipos.includes(k))} {label}</td>
          ))}
        </tr></tbody></table>

        <div style={{ display: 'flex', gap: '0.7rem' }}>
          <div style={{ flex: 1 }}>
            {secTitle('Sacramentos')}
            <table style={tbl}><tbody>
              <tr><td style={lbl}>Sacramento</td><td style={{ ...lbl, textAlign: 'center' }}>Rec.?</td><td style={lbl}>Data</td></tr>
              {SACR_PRINT.map(([k, label]) => (
                <tr key={k}>
                  <td style={cell}>{label}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{chk(!!(sacr[k]?.received || sacr[k]?.date))}</td>
                  <td style={{ ...cell, minWidth: 90 }}>{fmtDate(sacr[k]?.date) || ' '}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
          <div style={{ flex: 1 }}>
            {secTitle('Investidura')}
            <table style={tbl}><tbody>
              <tr><td style={lbl}>Investidura</td><td style={{ ...lbl, textAlign: 'center' }}>Rec.?</td><td style={lbl}>Data</td></tr>
              {INV_PRINT.map(([k, label]) => (
                <tr key={k}>
                  <td style={cell}>{label}</td>
                  <td style={{ ...cell, textAlign: 'center' }}>{chk(!!inv[k])}</td>
                  <td style={{ ...cell, minWidth: 90 }}>{fmtDate(inv[k]?.date) || ' '}</td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>

        {secTitle('Comunidade que Atua — dias e horários de missa')}
        {atua.length === 0 ? (
          <div style={{ border: '1px solid #444', minHeight: '2.4rem', padding: '0.35rem 0.5rem', fontSize: '0.85rem', marginBottom: '0.7rem', color: '#64748b' }}>
            Nenhuma comunidade selecionada no cadastro.
          </div>
        ) : atua.map(name => {
          const comm = communities.find(c => c.name === name);
          const all = buildMassRows(comm?.mass_schedules);
          const keys = new Set(part[name] || []);
          const rows = keys.size ? all.filter(r => keys.has(`${r.dow}|${r.time}|${r.nth}`)) : all;
          return (
            <table key={name} style={tbl}><tbody>
              <tr>
                <td colSpan={3} style={{ ...cell, background: '#dbeafe', fontWeight: 700 }}>
                  {chk(true)} {name}
                </td>
              </tr>
              {keys.size === 0 ? (
                <>
                  <tr>
                    <td colSpan={3} style={{ ...cell, color: '#b45309', fontSize: '0.8rem' }}>
                      Preencha abaixo os dias e horários das missas em que participa nesta comunidade, incluindo a frequência (1ª a 5ª semana do mês):
                    </td>
                  </tr>
                  <tr>
                    <td style={lbl}>Evento (Missa)</td>
                    <td style={{ ...lbl, textAlign: 'center' }}>Frequência / Dia (ex: 2ª SEG)</td>
                    <td style={{ ...lbl, textAlign: 'center' }}>Horário</td>
                  </tr>
                  {[0, 1, 2, 3].map(i => (
                    <tr key={i}>
                      <td style={{ ...cell, height: '1.4rem' }}>{' '}</td>
                      <td style={cell}>{' '}</td>
                      <td style={cell}>{' '}</td>
                    </tr>
                  ))}
                </>
              ) : (
                <>
                  <tr>
                    <td style={lbl}>Evento</td>
                    <td style={{ ...lbl, textAlign: 'center' }}>Participação</td>
                    <td style={{ ...lbl, textAlign: 'center' }}>Horário</td>
                  </tr>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={cell}>{r.eventName}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{nthSuf(r.nth, r.dow)} {r.dow}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{r.time}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody></table>
          );
        })}

        {secTitle('Anotações (restrições alimentares, medicações de uso contínuo, prescrição médica, e outros)')}
        <div style={{ border: '1px solid #444', minHeight: '3.2rem', padding: '0.35rem 0.5rem', fontSize: '0.85rem', marginBottom: '0.7rem', whiteSpace: 'pre-wrap' }}>
          {item.observations || ' '}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.6rem', fontSize: '0.8rem', color: '#475569' }}>
          <div style={{ borderTop: '1px solid #444', paddingTop: '0.2rem', width: '45%', textAlign: 'center' }}>Assinatura do Responsável</div>
          <div style={{ borderTop: '1px solid #444', paddingTop: '0.2rem', width: '45%', textAlign: 'center' }}>Coordenação</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '0.72rem', color: '#64748b', marginTop: '0.6rem' }}>
          Emitido em {new Date().toLocaleDateString('pt-BR')}
        </div>
      </div>
    </div>
  );
}

// ─── Módulo de Agenda ──────────────────────────────────────────────────────
const eventoEhMissa = (n) => /^\s*missa/i.test(n || '');
const AG_DOW_LBL = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const AG_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const agNthSuf = (nth, dow) => `${nth}${(dow === 'DOM' || dow === 'SAB') ? 'º' : 'ª'}`;
const agTh = { background: '#1e3a8a', color: '#fff', border: '1px solid #1e40af', padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' };
const agTd = { border: '1px solid #cbd5e1', padding: '0.3rem 0.6rem', fontSize: '0.82rem', background: '#fff' };
const agSel = { padding: '0.35rem 0.6rem', borderRadius: 5, border: '1px solid #93c5fd', fontSize: '0.85rem', background: 'rgba(255,255,255,0.95)', color: '#1e3a8a', fontWeight: 600, maxWidth: '100%' };
const agCard = { background: 'linear-gradient(to right, #eff6ff, #f8fafc)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.7rem 1rem', marginBottom: '0.8rem' };

// Normaliza as chaves "DOW|hora|semana" (corrige horários digitados com ; em vez de :)
const normParticipKey = (k) => {
  const parts = k.split('|');
  if (parts.length === 3) parts[1] = parts[1].replace(';', ':');
  return parts.join('|');
};
const parseParticipation = (raw) => {
  try {
    const p = JSON.parse(raw || '{}');
    if (!p || typeof p !== 'object') return {};
    const out = {};
    Object.entries(p).forEach(([comm, keys]) => { out[comm] = (keys || []).map(normParticipKey); });
    return out;
  } catch { return {}; }
};

// Tabela padrão da agenda (Evento | Participação | Horário [| Servidores])
function AgendaTabela({ titulo, rows, participantes }) {
  if (!rows.length) return null;
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e3a8a', margin: '0.3rem 0' }}>{titulo}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: participantes ? '100%' : 'auto' }}>
          <thead><tr>
            <th style={{ ...agTh, textAlign: 'left', minWidth: 170 }}>Evento</th>
            <th style={{ ...agTh, width: 110 }}>Participação</th>
            <th style={{ ...agTh, width: 80 }}>Horário</th>
            {participantes && <th style={{ ...agTh, textAlign: 'left' }}>Servidores Participantes</th>}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ ...agTd, fontWeight: 600, whiteSpace: 'nowrap', paddingRight: '1.5rem' }}>{r.eventName}</td>
                <td style={{ ...agTd, textAlign: 'center', whiteSpace: 'nowrap' }}>{agNthSuf(r.nth, r.dow)} {r.dow}</td>
                <td style={{ ...agTd, textAlign: 'center', whiteSpace: 'nowrap' }}>{r.time}</td>
                {participantes && (
                  <td style={{ ...agTd, fontSize: '0.78rem' }}>
                    <GruposParticipantes grupos={participantes[`${r.dow}|${r.time}|${r.nth}`]} vazio="—" />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Mapa "DOW|hora|semana" → { funcao: [nomes] } dos servidores escalados na comunidade
function montarMapaParticipantes(servers, commName) {
  const map = {};
  servers.forEach(s => {
    const part = parseParticipation(s.participation);
    (part[commName] || []).forEach(k => {
      const grupos = (map[k] = map[k] || {});
      const t = s.type || 'outro';
      const nome = s.full_name || s.nome || '';
      if (!(grupos[t] = grupos[t] || []).includes(nome)) grupos[t].push(nome);
    });
  });
  Object.values(map).forEach(g => Object.values(g).forEach(l => l.sort((a, b) => a.localeCompare(b))));
  return map;
}

// Exibição padrão dos escalados: uma linha por função, só as funções com alguém escalado
const AG_GRUPO_ORDEM = [
  ['monitor', 'Monitores'],
  ['acolito', 'Acólitos'],
  ['coroinha', 'Coroinhas'],
  ['cerimoniario', 'Cerimoniários'],
  ['coordenador', 'Coordenadores']
];
function GruposParticipantes({ grupos, vazio = 'sem servidores designados' }) {
  const linhas = AG_GRUPO_ORDEM.filter(([k]) => grupos && grupos[k] && grupos[k].length);
  if (!linhas.length) return <span style={{ color: 'var(--text-muted)' }}>{vazio}</span>;
  return (
    <span style={{ display: 'inline-block', verticalAlign: 'top' }}>
      {linhas.map(([k, label]) => (
        <div key={k}><strong>{label}:</strong> {grupos[k].join(', ')}</div>
      ))}
    </span>
  );
}

function AgendaServidor({ servers, communities, isMobile, restrictCadastro }) {
  const [id, setId] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  // Servidor (não-coordenador) só pode ver a própria agenda — nada de escolher outro cadastro
  const servers2 = restrictCadastro ? servers.filter(s => s.cadastro === restrictCadastro) : servers;
  useEffect(() => {
    if (restrictCadastro && servers2.length > 0) setId(String(servers2[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restrictCadastro, servers2.length]);
  const serv = servers2.find(s => String(s.id) === id);
  // Próximas participações: percorre os próximos meses e casa cada data com as
  // semanas/horários marcados na participação do servidor
  const proximas = React.useMemo(() => {
    if (!serv) return [];
    let atuaM = []; let partM = {};
    try { atuaM = JSON.parse(serv.community_atua || '[]'); } catch { atuaM = []; }
    partM = parseParticipation(serv.participation);
    const out = [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    // cobre do dia 1 do mês atual até o último dia do 6º mês (semestre em calendário civil)
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 6, 0);
    const totalDias = Math.round((fim - inicio) / 86400000) + 1;
    for (let i = 0; i < totalDias; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const dow = AG_DOW_LBL[d.getDay()];
      const nth = Math.ceil(d.getDate() / 7);
      atuaM.forEach(name => {
        const comm = communities.find(c => c.name === name);
        const keys = new Set(partM[name] || []);
        buildMassRows(comm?.mass_schedules).forEach(r => {
          if (r.dow === dow && r.nth === nth && keys.has(`${r.dow}|${r.time}|${r.nth}`)) {
            out.push({ date: d, time: r.time, evento: r.eventName, comunidade: name });
          }
        });
      });
    }
    out.sort((a, b) => a.date - b.date || a.time.localeCompare(b.time));
    return out;
  }, [serv, communities]);

  const nomeServ = serv ? (serv.full_name || '') : '';
  const pdfFilenameAgenda = `Agenda-${serv?.cadastro || 'sn'}-${nomeServ.trim().replace(/\s+/g, '-')}.pdf`;
  const podeCompartilharArquivo = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([new Blob()], 'f.pdf', { type: 'application/pdf' })] });

  const pdfOptionsAgenda = () => ({
    margin: [8, 8],
    filename: pdfFilenameAgenda,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, ignoreElements: (el) => !!el.classList && el.classList.contains('no-print') },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  });

  const gerarPdfAgenda = async () => {
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      await html2pdf().set(pdfOptionsAgenda()).from(document.getElementById('agenda-print')).save();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const enviarPdfWhatsApp = async () => {
    const msg = `Agenda de Participação — ${nomeServ}${serv?.cadastro ? ` (Cadastro Nº ${serv.cadastro})` : ''}`;
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      const worker = html2pdf().set(pdfOptionsAgenda()).from(document.getElementById('agenda-print'));
      if (podeCompartilharArquivo) {
        const blob = await worker.outputPdf('blob');
        const file = new File([blob], pdfFilenameAgenda, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: 'Agenda de Participação', text: msg });
      } else {
        await worker.save();
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Erro ao enviar pelo WhatsApp:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);

  return (
    <div>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #agenda-print, #agenda-print * { visibility: visible !important; }
        #agenda-print { position: absolute !important; left: 0; top: 0; width: 100% !important; }
        .no-print { display: none !important; }
      }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.8rem' }}>
        {restrictCadastro ? (
          <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem' }}>{serv?.full_name || 'Minha agenda'}</span>
        ) : (
          <select value={id} onChange={e => setId(e.target.value)} style={agSel}>
            <option value="">-- Selecione o Servidor --</option>
            {servers2.map(s => <option key={s.id} value={s.id}>{(s.cadastro ? s.cadastro + ' — ' : '') + (s.full_name || '')}</option>)}
          </select>
        )}
        {serv && (
          <>
            <button onClick={() => setMostrarPreview(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Eye size={15} /> Visualizar
            </button>
            {!restrictCadastro && (
              <button onClick={() => setId('')} title="Limpar seleção e ver o próximo servidor"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
          </>
        )}
      </div>

      {/* Versão mobile: lista cronológica de cards em vez da grade de 6 meses */}
      {isMobile && serv && (
        <div>
          {proximas.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nenhuma participação nos próximos meses — verifique se os horários foram marcados no cadastro do servidor.
            </p>
          ) : proximas.map((p, i) => {
            const ehHoje = p.date.getTime() === hoje0.getTime();
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.7rem 0.9rem',
                borderRadius: 8, marginBottom: '0.5rem',
                background: ehHoje ? '#fef9c3' : '#f0fdf4', border: `1px solid ${ehHoje ? '#facc15' : '#bbf7d0'}`
              }}>
                <div style={{ textAlign: 'center', minWidth: '52px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#14532d', textTransform: 'uppercase' }}>
                    {p.date.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#14532d' }}>
                    {p.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{p.evento}</div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{p.comunidade} — às {p.time}</div>
                </div>
                {ehHoje && <span style={{ background: '#ca8a04', color: '#fff', borderRadius: 4, padding: '0.15rem 0.4rem', fontSize: '0.65rem', fontWeight: 800 }}>HOJE</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de visualização do layout de impressão, com opções de baixar PDF e enviar por WhatsApp */}
      {serv && mostrarPreview && (
        <div onClick={() => setMostrarPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '95%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar Agenda</span>
              <button onClick={() => setMostrarPreview(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.2rem', overflowY: 'auto' }}>
              <div id="agenda-print">
      <div style={{ borderBottom: '2px solid #1e3a8a', paddingBottom: '0.3rem', marginBottom: '0.7rem' }}>
        <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e3a8a' }}>
          Agenda de Participação — {nomeServ}{serv.cadastro ? ` (Cadastro Nº ${serv.cadastro})` : ''}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ZelusDomus • Servidores do Altar • Emitida em {new Date().toLocaleDateString('pt-BR')}</div>
      </div>
      {/* Calendários civis das participações — informação completa em formato visual */}
      <div style={{ ...agCard, background: 'linear-gradient(to right, #f0fdf4, #f8fafc)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#14532d', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
          <CalendarDays size={15} /> Próximas Participações (próximos 6 meses)
        </div>
        {proximas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nenhuma participação nos próximos 90 dias — verifique se os horários foram marcados no cadastro do servidor.
          </p>
        ) : (() => {
          // Calendário civil: um mês por quadro, todas as datas mantidas;
          // nos dias de participação aparece apenas o horário
          const porData = {};
          proximas.forEach(p => {
            const k = p.date.toDateString();
            (porData[k] = porData[k] || []).push(p);
          });
          const DIAS_CAB = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
          const meses = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(hoje0.getFullYear(), hoje0.getMonth() + i, 1);
            return { y: d.getFullYear(), m: d.getMonth() };
          });
          const semanasDoMes = (y, m) => {
            const first = new Date(y, m, 1).getDay();
            const total = new Date(y, m + 1, 0).getDate();
            const semanas = []; let linha = Array(first).fill(null);
            for (let d = 1; d <= total; d++) {
              linha.push(d);
              if (linha.length === 7) { semanas.push(linha); linha = []; }
            }
            if (linha.length) semanas.push([...linha, ...Array(7 - linha.length).fill(null)]);
            return semanas;
          };
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.8rem' }}>
              {meses.map(({ y, m }) => (
                <div key={`${y}-${m}`} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: '#14532d', color: '#fff', fontWeight: 800, fontSize: '0.85rem', textAlign: 'center', padding: '0.3rem' }}>
                    {AG_MESES[m]} de {y}
                  </div>
                  <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                    <thead><tr>
                      {DIAS_CAB.map(d => (
                        <th key={d} style={{ background: '#166534', color: '#fff', fontSize: '0.66rem', fontWeight: 700, padding: '0.2rem', border: '1px solid #14532d' }}>{d}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {semanasDoMes(y, m).map((sem, si) => (
                        <tr key={si}>
                          {sem.map((d, di) => {
                            if (d === null) return <td key={di} style={{ border: '1px solid #e2e8f0', background: '#f8fafc' }}>{' '}</td>;
                            const date = new Date(y, m, d);
                            const itens = (porData[date.toDateString()] || []).sort((a, b) => a.time.localeCompare(b.time));
                            const ehHoje = date.getTime() === hoje0.getTime();
                            return (
                              <td key={di} style={{ border: '1px solid #e2e8f0', verticalAlign: 'top', height: '2.6rem', padding: '0.12rem',
                                background: ehHoje ? '#fef9c3' : itens.length ? '#dcfce7' : '#fff' }}>
                                <div style={{ display: 'flex', justifyContent: ehHoje ? 'space-between' : 'flex-end', alignItems: 'center', paddingRight: '0.15rem', paddingLeft: '0.15rem' }}>
                                  {ehHoje && <span style={{ background: '#ca8a04', color: '#fff', borderRadius: 3, padding: '0 0.25rem', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.03em' }}>HOJE</span>}
                                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>{d}</span>
                                </div>
                                {itens.map((p, i) => (
                                  <div key={i} title={`${p.evento} — ${p.comunidade}`}
                                    style={{ fontSize: '0.7rem', fontWeight: 800, color: '#14532d', textAlign: 'center', lineHeight: 1.25 }}>
                                    {p.time}
                                  </div>
                                ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={gerarPdfAgenda} disabled={gerandoPdf}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                <Download size={15} /> {gerandoPdf ? 'Gerando…' : 'Baixar PDF'}
              </button>
              <button onClick={enviarPdfWhatsApp} disabled={gerandoPdf}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                <Share2 size={15} /> Enviar por WhatsApp
              </button>
              <button onClick={() => setMostrarPreview(false)}
                style={{ marginLeft: 'auto', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgendaComunidade({ servers, communities, isMobile }) {
  const [cid, setCid] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const comm = communities.find(c => String(c.id) === cid);
  const all = comm ? buildMassRows(comm.mass_schedules) : [];
  const partMap = React.useMemo(() => comm ? montarMapaParticipantes(servers, comm.name) : {}, [servers, comm]);

  const hoje0 = new Date(); hoje0.setHours(0, 0, 0, 0);
  const domingoAtual = new Date(hoje0);
  domingoAtual.setDate(hoje0.getDate() - hoje0.getDay());
  // A semana atual e as 4 próximas semanas
  const semanas = [0, 1, 2, 3, 4].map(w => {
    const dom = new Date(domingoAtual); dom.setDate(domingoAtual.getDate() + w * 7);
    return {
      rotulo: w === 0 ? 'Semana atual' : w === 1 ? 'Próxima semana' : `Em ${w} semanas`,
      dias: Array.from({ length: 7 }, (_, i) => { const d = new Date(dom); d.setDate(dom.getDate() + i); return d; })
    };
  });
  const nomeCurto = (n) => (n || '').trim().split(/\s+/).slice(0, 2).join(' ');
  const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const LINHAS = [['monitor', 'Monitor'], ['acolito', 'Acólitos'], ['coroinha', 'Coroinhas']];

  // Eventos de cada semana, pré-calculados uma vez e reaproveitados tanto na
  // versão mobile (cards) quanto na versão desktop (tabela, usada no PDF/impressão)
  const semanasComEventos = React.useMemo(() => semanas.map(({ rotulo, dias }) => {
    const eventos = [];
    dias.forEach(d => {
      const dow = AG_DOW_LBL[d.getDay()];
      const nth = Math.ceil(d.getDate() / 7);
      all.filter(r => r.dow === dow && r.nth === nth && r.time !== '07:00')
        .sort((a, b) => a.time.localeCompare(b.time))
        .forEach(r => eventos.push({ data: d, dow, time: r.time, grupos: partMap[`${r.dow}|${r.time}|${r.nth}`] || {} }));
    });
    const nthDom = Math.ceil(dias[0].getDate() / 7);
    return { rotulo, dias, eventos, nthDom };
  }), [semanas, all, partMap]);

  const pdfFilenameComunidade = `Agenda-${(comm?.name || 'comunidade').trim().replace(/\s+/g, '-')}.pdf`;
  const podeCompartilharArquivo = typeof navigator !== 'undefined' && !!navigator.canShare
    && navigator.canShare({ files: [new File([new Blob()], 'f.pdf', { type: 'application/pdf' })] });

  const pdfOptionsComunidade = () => ({
    margin: [8, 8],
    filename: pdfFilenameComunidade,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true, ignoreElements: (el) => !!el.classList && el.classList.contains('no-print') },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  });

  const gerarPdfComunidade = async () => {
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      await html2pdf().set(pdfOptionsComunidade()).from(document.getElementById('agenda-com-print')).save();
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      alert('Não foi possível gerar o PDF. Tente novamente.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const enviarPdfComunidadeWhatsApp = async () => {
    const msg = `Agenda da Comunidade — ${comm?.name || ''}`;
    setGerandoPdf(true);
    try {
      const html2pdf = await loadHtml2pdf();
      const worker = html2pdf().set(pdfOptionsComunidade()).from(document.getElementById('agenda-com-print'));
      if (podeCompartilharArquivo) {
        const blob = await worker.outputPdf('blob');
        const file = new File([blob], pdfFilenameComunidade, { type: 'application/pdf' });
        await navigator.share({ files: [file], title: 'Agenda da Comunidade', text: msg });
      } else {
        await worker.save();
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      }
    } catch (e) {
      if (e?.name !== 'AbortError') console.error('Erro ao enviar pelo WhatsApp:', e);
    } finally {
      setGerandoPdf(false);
    }
  };

  return (
    <div>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #agenda-com-print, #agenda-com-print * { visibility: visible !important; }
        #agenda-com-print { position: absolute !important; left: 0; top: 0; width: 100% !important; }
        .no-print { display: none !important; }
      }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.8rem' }}>
        <select value={cid} onChange={e => setCid(e.target.value)} style={agSel}>
          <option value="">-- Selecione a Comunidade --</option>
          {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {comm && (
          <>
            <button onClick={() => setMostrarPreview(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <Eye size={15} /> Visualizar
            </button>
            <button onClick={() => setCid('')} title="Limpar seleção e ver a próxima comunidade"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#64748b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem' }}>
              <ChevronLeft size={16} /> Voltar
            </button>
          </>
        )}
      </div>

      {/* Versão mobile: um card por evento, com Monitor/Acólitos/Coroinhas empilhados */}
      {isMobile && comm && (
        <div>
          {all.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum evento cadastrado para esta comunidade.</p>
          ) : semanasComEventos.map(({ rotulo, dias, eventos, nthDom }) => (
            <div key={rotulo} style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#14532d', marginBottom: '0.4rem' }}>
                {rotulo} — {nthDom}ª semana ({fmt(dias[0])} a {fmt(dias[6])})
              </div>
              {eventos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Sem missas ou eventos nesta semana.</p>
              ) : eventos.map((ev, i) => {
                const ehHoje = ev.data.getTime() === hoje0.getTime();
                return (
                  <div key={i} style={{ background: ehHoje ? '#fef9c3' : '#f0fdf4', border: `1px solid ${ehHoje ? '#facc15' : '#bbf7d0'}`, borderRadius: 8, padding: '0.7rem 0.9rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#14532d', marginBottom: '0.4rem' }}>
                      {ev.dow} - {fmt(ev.data)} às {ev.time} horas
                    </div>
                    {LINHAS.map(([k, label]) => {
                      const nomes = [...new Set((ev.grupos[k] || []).map(nomeCurto))];
                      return (
                        <div key={k} style={{ display: 'flex', gap: '0.4rem', fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                          <span style={{ fontWeight: 700, color: '#14532d', minWidth: '70px' }}>{label}:</span>
                          <span style={{ color: '#334155' }}>{nomes.length ? nomes.join(', ') : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Modal de visualização do layout de impressão, com opções de baixar PDF e enviar por WhatsApp */}
      {comm && mostrarPreview && (
        <div onClick={() => setMostrarPreview(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 8, width: '95%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.2rem', background: '#1e293b' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Visualizar Agenda</span>
              <button onClick={() => setMostrarPreview(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '1.2rem', overflowY: 'auto' }}>
              <div id="agenda-com-print">
        <div style={{ borderBottom: '2px solid #1e3a8a', paddingBottom: '0.3rem', marginBottom: '0.7rem' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: '#1e3a8a' }}>Agenda da Comunidade — {comm.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ZelusDomus • Servidores do Altar • Emitida em {new Date().toLocaleDateString('pt-BR')}</div>
        </div>
        {all.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhum evento cadastrado para esta comunidade.</p>
        ) : semanasComEventos.map(({ rotulo, dias, eventos, nthDom }) => {
          return (
            <div key={rotulo} style={{ ...agCard, background: 'linear-gradient(to right, #f0fdf4, #f8fafc)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#14532d', marginBottom: '0.4rem' }}>
                {rotulo} — {nthDom}ª semana ({fmt(dias[0])} a {fmt(dias[6])})
              </div>
              {eventos.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Sem missas ou eventos nesta semana.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 90 }} />
                      {eventos.map((_, i) => <col key={i} />)}
                    </colgroup>
                    <thead><tr>
                      <th style={{ ...agTh, background: '#14532d', borderColor: '#166534', width: 90, textAlign: 'left' }}>{' '}</th>
                      {eventos.map((ev, i) => {
                        const ehHoje = ev.data.getTime() === hoje0.getTime();
                        return (
                          <th key={i} style={{ ...agTh, background: ehHoje ? '#ca8a04' : '#166534', borderColor: '#14532d', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                            {ev.dow} - {fmt(ev.data)}<br />
                            <span style={{ whiteSpace: 'nowrap' }}>às {ev.time} horas</span>
                          </th>
                        );
                      })}
                    </tr></thead>
                    <tbody>
                      {LINHAS.map(([k, label]) => (
                        <tr key={k}>
                          <td style={{ ...agTd, fontWeight: 800, color: '#14532d', background: '#f0fdf4' }}>{label}</td>
                          {eventos.map((ev, i) => {
                            const nomes = [...new Set((ev.grupos[k] || []).map(nomeCurto))];
                            const ehHoje = ev.data.getTime() === hoje0.getTime();
                            const destaque = k === 'monitor';
                            return (
                              <td key={i} style={{ ...agTd, textAlign: 'center', verticalAlign: 'top', background: ehHoje ? '#fef9c3' : '#dcfce7' }}>
                                {nomes.length === 0
                                  ? <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                                  : nomes.map((n, j) => (
                                    <div key={j} style={{ marginBottom: '0.12rem', whiteSpace: 'nowrap',
                                      background: destaque ? '#fde047' : 'transparent', borderRadius: 3,
                                      padding: destaque ? '0.08rem 0.3rem' : 0, width: 'fit-content', marginLeft: 'auto', marginRight: 'auto' }}>
                                      <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#14532d', whiteSpace: 'nowrap' }}>{n}</span>
                                    </div>
                                  ))}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', padding: '0.9rem 1.2rem', borderTop: '1px solid #e2e8f0' }}>
              <button onClick={gerarPdfComunidade} disabled={gerandoPdf}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                <Download size={15} /> {gerandoPdf ? 'Gerando…' : 'Baixar PDF'}
              </button>
              <button onClick={enviarPdfComunidadeWhatsApp} disabled={gerandoPdf}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, cursor: gerandoPdf ? 'wait' : 'pointer', padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem' }}>
                <Share2 size={15} /> Enviar por WhatsApp
              </button>
              <button onClick={() => setMostrarPreview(false)}
                style={{ marginLeft: 'auto', background: '#94a3b8', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarioAnual({ servers, communities, isMobile }) {
  const now = new Date();
  const [cid, setCid] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [sel, setSel] = useState(null); // { rotulo, datas: [Date] }
  const [mesMobile, setMesMobile] = useState(now.getMonth());
  const comm = communities.find(c => String(c.id) === cid);
  const all = comm ? buildMassRows(comm.mass_schedules) : [];
  const partMap = React.useMemo(() => comm ? montarMapaParticipantes(servers, comm.name) : {}, [servers, comm]);
  // Primeiro + último nome (evita ambiguidade entre servidores com o mesmo primeiro nome)
  const nomeCurto = (n) => {
    const partes = (n || '').trim().split(/\s+/);
    const curto = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1]}` : partes[0] || '';
    return curto.replace(/ /g, ' '); // nbsp: nome de uma pessoa nunca quebra no meio
  };

  const diasNoMes = (m) => new Date(year, m + 1, 0).getDate();
  const temEvento = (m, d) => {
    const dow = AG_DOW_LBL[new Date(year, m, d).getDay()];
    const nth = Math.ceil(d / 7);
    return all.some(r => r.dow === dow && r.nth === nth);
  };
  const selDia = (m, d) => setSel({ rotulo: `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${year}`, datas: [new Date(year, m, d)] });
  const selSemana = (m, dias) => setSel({
    rotulo: `Semana de ${String(dias[0]).padStart(2, '0')} a ${String(dias[dias.length - 1]).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${year}`,
    datas: dias.map(d => new Date(year, m, d))
  });
  const selMes = (m) => setSel({
    rotulo: `${AG_MESES[m]} de ${year}`,
    datas: Array.from({ length: diasNoMes(m) }, (_, i) => new Date(year, m, i + 1))
  });

  // Monta as semanas (linhas do calendário) de um mês
  const semanasDoMes = (m) => {
    const primeiro = new Date(year, m, 1).getDay();
    const total = diasNoMes(m);
    const semanas = [];
    let linha = Array(primeiro).fill(null);
    for (let d = 1; d <= total; d++) {
      linha.push(d);
      if (linha.length === 7) { semanas.push(linha); linha = []; }
    }
    if (linha.length) semanas.push([...linha, ...Array(7 - linha.length).fill(null)]);
    return semanas;
  };

  const resultados = sel ? sel.datas.map(date => {
    const dow = AG_DOW_LBL[date.getDay()];
    const nth = Math.ceil(date.getDate() / 7);
    const rows = all.filter(r => r.dow === dow && r.nth === nth)
      .sort((a, b) => (eventoEhMissa(b.eventName) ? 1 : 0) - (eventoEhMissa(a.eventName) ? 1 : 0) || a.time.localeCompare(b.time));
    return { date, rows };
  }).filter(x => x.rows.length) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <select value={cid} onChange={e => { setCid(e.target.value); setSel(null); }} style={agSel}>
          <option value="">-- Selecione a Comunidade --</option>
          {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={year} onChange={e => { setYear(Number(e.target.value)); setSel(null); }} style={agSel}>
          {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {!comm ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Selecione uma comunidade para ver o calendário: clique em um dia, na seta da semana ou no nome do mês para listar os participantes.</p>
      ) : isMobile ? (
        <>
          {/* Versão mobile: um mês por vez, navegação com setas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <button onClick={() => { const novo = (mesMobile + 11) % 12; setMesMobile(novo); selMes(novo); }} style={{ background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>◀</button>
            <button onClick={() => selMes(mesMobile)} title="Ver participantes do mês inteiro"
              style={{ flex: 1, margin: '0 0.5rem', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.5rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
              {AG_MESES[mesMobile]} de {year}
            </button>
            <button onClick={() => { const novo = (mesMobile + 1) % 12; setMesMobile(novo); selMes(novo); }} style={{ background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 6, padding: '0.4rem 0.7rem', cursor: 'pointer', fontWeight: 700 }}>▶</button>
          </div>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <thead><tr>
              <th style={{ width: 20 }}></th>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <th key={i} style={{ color: '#64748b', fontWeight: 700, padding: '0.3rem' }}>{d}</th>)}
            </tr></thead>
            <tbody>
              {semanasDoMes(mesMobile).map((semana, si) => (
                <tr key={si}>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => selSemana(mesMobile, semana.filter(Boolean))} title="Ver participantes desta semana"
                      style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', padding: 0, fontWeight: 700 }}>▸</button>
                  </td>
                  {semana.map((d, di) => d === null ? <td key={di}></td> : (
                    <td key={di} style={{ textAlign: 'center', padding: '0.15rem' }}>
                      <button onClick={() => selDia(mesMobile, d)} title="Ver participantes deste dia"
                        style={{ width: 34, height: 30, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: '0.85rem',
                          fontWeight: temEvento(mesMobile, d) ? 700 : 400,
                          background: temEvento(mesMobile, d) ? '#dbeafe' : 'transparent',
                          color: temEvento(mesMobile, d) ? '#1e3a8a' : '#475569' }}>
                        {d}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(180px, 1fr))', gap: '0.7rem', marginBottom: '1rem', overflowX: 'auto' }}>
            {AG_MESES.map((nomeMes, m) => (
              <div key={m} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.5rem' }}>
                <button onClick={() => selMes(m)} title="Ver participantes do mês inteiro"
                  style={{ width: '100%', background: '#1e3a8a', color: '#fff', border: 'none', borderRadius: 5, padding: '0.25rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', marginBottom: '0.3rem' }}>
                  {nomeMes}
                </button>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.7rem' }}>
                  <thead><tr>
                    <th style={{ width: 16 }}></th>
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <th key={i} style={{ color: '#64748b', fontWeight: 700, padding: '0.1rem' }}>{d}</th>)}
                  </tr></thead>
                  <tbody>
                    {semanasDoMes(m).map((semana, si) => (
                      <tr key={si}>
                        <td>
                          <button onClick={() => selSemana(m, semana.filter(Boolean))} title="Ver participantes desta semana"
                            style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.7rem', padding: 0, fontWeight: 700 }}>▸</button>
                        </td>
                        {semana.map((d, di) => d === null ? <td key={di}></td> : (
                          <td key={di} style={{ textAlign: 'center', padding: '0.05rem' }}>
                            <button onClick={() => selDia(m, d)} title="Ver participantes deste dia"
                              style={{ width: 22, height: 20, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.7rem',
                                fontWeight: temEvento(m, d) ? 700 : 400,
                                background: temEvento(m, d) ? '#dbeafe' : 'transparent',
                                color: temEvento(m, d) ? '#1e3a8a' : '#475569' }}>
                              {d}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}

      {comm && sel && (
        <div style={agCard}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#1e3a8a', marginBottom: '0.4rem' }}>
            Participantes — {comm.name} — {sel.rotulo}
          </div>
          {resultados.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nenhuma missa ou evento nesse período.</p>
          ) : isMobile ? (
            /* Versão mobile: um card por participação, em vez da tabela de 5 colunas */
            resultados.flatMap(({ date, rows }) => rows.map((r, i) => ({ date, r, i })))
              .sort((a, b) => a.r.time.localeCompare(b.r.time) || a.date - b.date || a.r.eventName.localeCompare(b.r.eventName))
              .map(({ date, r, i }) => {
                const grupos = partMap[`${r.dow}|${r.time}|${r.nth}`] || {};
                const mons = grupos.monitor || [];
                const acos = grupos.acolito || [];
                const cors = grupos.coroinha || [];
                return (
                  <div key={`${date.toISOString()}-${i}`} style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '0.7rem 0.9rem', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#1e3a8a' }}>{r.eventName}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>
                      <strong>{r.time}</strong> - {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span style={{ textTransform: 'capitalize' }}>{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 700, color: mons.length ? '#854d0e' : '#14532d' }}>Monitores: </span>
                      {mons.length ? mons.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontWeight: 700, color: '#14532d' }}>Acólitos: </span>
                      {acos.length ? acos.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: 700, color: '#14532d' }}>Coroinhas: </span>
                      {cors.length ? cors.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>
                  </div>
                );
              })
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>
                  <th style={{ ...agTh, textAlign: 'left', width: '13%' }}>Evento</th>
                  <th style={{ ...agTh, textAlign: 'left', width: '13%' }}>Horário e Data</th>
                  <th style={{ ...agTh, textAlign: 'left', width: '14%' }}>Monitores</th>
                  <th style={{ ...agTh, textAlign: 'left', width: '30%' }}>Acólitos</th>
                  <th style={{ ...agTh, textAlign: 'left', width: '30%' }}>Coroinhas</th>
                </tr></thead>
                <tbody>
                  {resultados.flatMap(({ date, rows }) => rows.map((r, i) => ({ date, r, i })))
                    .sort((a, b) => a.r.time.localeCompare(b.r.time) || a.date - b.date || a.r.eventName.localeCompare(b.r.eventName))
                    .map(({ date, r, i }) => {
                    const grupos = partMap[`${r.dow}|${r.time}|${r.nth}`] || {};
                    const mons = grupos.monitor || [];
                    const acos = grupos.acolito || [];
                    const cors = grupos.coroinha || [];
                    return (
                      <tr key={`${date.toISOString()}-${i}`}>
                        <td style={{ ...agTd, verticalAlign: 'top', fontWeight: 700, fontSize: '0.82rem' }}>{r.eventName}</td>
                        <td style={{ ...agTd, verticalAlign: 'top', fontSize: '0.78rem' }}>
                          <strong>{r.time}</strong> - {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} <span style={{ textTransform: 'capitalize' }}>{date.toLocaleDateString('pt-BR', { weekday: 'long' })}</span>.
                        </td>
                        <td style={{ ...agTd, verticalAlign: 'top', fontSize: '0.8rem', fontWeight: 700, color: mons.length ? '#854d0e' : undefined, background: mons.length ? '#fde047' : 'inherit' }}>
                          {mons.length ? mons.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                        </td>
                        <td style={{ ...agTd, verticalAlign: 'top', fontSize: '0.8rem', fontWeight: 600 }}>
                          {acos.length ? acos.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                        </td>
                        <td style={{ ...agTd, verticalAlign: 'top', fontSize: '0.8rem', fontWeight: 600 }}>
                          {cors.length ? cors.map(nomeCurto).join(', ') : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AgendaModule({ servers, communities, isMobile, restrictCadastro }) {
  const unicos = React.useMemo(() => {
    const seen = new Set(); const out = [];
    [...servers].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')).forEach(s => {
      const pid = s.person_id || s.id;
      if (!seen.has(pid)) { seen.add(pid); out.push(s); }
    });
    return out;
  }, [servers]);

  const secaoStyle = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
  const tituloStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#1e293b', color: '#fff', fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0.65rem 1rem' };
  const corpoStyle = { padding: '0.9rem' };

  return (
    <div className="grid-container" style={{ padding: '1rem 1.2rem 2rem', display: 'flex', flexDirection: 'column', maxHeight: 'none', overflow: 'visible' }}>
      <div style={secaoStyle}>
        <div style={tituloStyle}><Users size={15} /> Agenda do Servidor</div>
        <div style={corpoStyle}><AgendaServidor servers={unicos} communities={communities} isMobile={true} restrictCadastro={restrictCadastro} /></div>
      </div>

      <div style={secaoStyle}>
        <div style={tituloStyle}><Church size={15} /> Agenda da Comunidade</div>
        <div style={corpoStyle}><AgendaComunidade servers={servers} communities={communities} isMobile={true} /></div>
      </div>

      <div style={secaoStyle}>
        <div style={tituloStyle}><CalendarDays size={15} /> Calendário Anual</div>
        <div style={corpoStyle}><CalendarioAnual servers={servers} communities={communities} isMobile={true} /></div>
      </div>
    </div>
  );
}

function ServidoresTable({ data, title, onDelete, onEdit, onNew, communities = [] }) {
  const isCoroinha = title === 'Coroinhas';
  const colCount = 7;
  const roleColor = ROLE_COLORS[title.slice(0,-1)] || ROLE_COLORS['Coroinha'];
  const [fichaItem, setFichaItem] = useState(null);

  return (
    <div className="grid-container" style={{ overflowX: 'auto' }}>
      {fichaItem && <FichaCadastro item={fichaItem} communities={communities} onClose={() => setFichaItem(null)} />}
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '100px', textAlign: 'center' }}>Ações</th>
            <th style={{ width: '80px', textAlign: 'center' }}>Cadastro</th>
            <th>Nome</th>
            <th>Nascimento</th>
            <th>Telefone/WhatsApp</th>
            <th>Endereço</th>
            <th>Comunidade que Atua</th>
          </tr>
        </thead>
        <tbody>
          {[...data].sort((a, b) => (parseInt(a.cadastro) || 0) - (parseInt(b.cadastro) || 0)).map((item) => (
            <tr key={item.id}>
              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                <button title="Visualizar ficha completa" onClick={() => setFichaItem(item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                  onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                ><Eye size={14} /></button>
                <button title="Editar" onClick={() => onEdit && onEdit(item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                  onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                ><Pencil size={14} /></button>
                <button title="Excluir" onClick={() => onDelete && onDelete(item.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                  onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                  onMouseOut={e => e.currentTarget.style.background = 'none'}
                ><Trash2 size={14} /></button>
              </td>
              <td style={{ textAlign: 'center', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.cadastro || '-'}</td>
              <ClampCell maxWidth={200} tdStyle={{ fontWeight: 500 }}>{item.full_name || item.nome}</ClampCell>
              <td style={{ whiteSpace: 'nowrap' }}>{item.dob ? item.dob.slice(0, 10).split('-').reverse().join('/') : item.nascimento}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{isCoroinha ? (item.phone || item.telefone || '-') : <WhatsAppLink phone={item.phone || item.telefone} />}</td>
              <ClampCell maxWidth={210}><AddressLink address={item.address || item.endereco} /></ClampCell>
              {(() => {
                let names = [];
                try { names = JSON.parse(item.community_atua || '[]'); } catch {}
                if (!names.length && item.comunidadeAtua) names = [item.comunidadeAtua];
                const chips = (wrap) => (
                  <div style={{ display: 'flex', flexWrap: wrap ? 'wrap' : 'nowrap', gap: '0.25rem' }}>
                    {names.map(n => {
                      const c = getCommunityColor(n);
                      return (
                        <span key={n} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: '4px', padding: '0.1rem 0.45rem', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {n}
                        </span>
                      );
                    })}
                  </div>
                );
                if (!names.length) return <td><span style={{ color: 'var(--text-muted)' }}>-</span></td>;
                return <ClampCell maxWidth={240} full={chips(true)}>{chips(false)}</ClampCell>;
              })()}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={colCount} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum {title.toLowerCase()} cadastrado.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ComunidadesTable({ data, onDelete, onEdit, onNew }) {
  const DIAS_KEYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <Church size={48} color="var(--text-muted)" style={{ margin: '0 auto 1rem' }} />
        <h3>Nenhuma comunidade cadastrada.</h3>
        {onNew && <button onClick={onNew} className="btn-primary" style={{ marginTop: '1rem' }}><PlusCircle size={15} /> Cadastrar Nova Comunidade</button>}
      </div>
    );
  }

  return (
    <div className="grid-container" style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '140px', minWidth: '120px' }}>Nome</th>
            <th style={{ width: '160px', minWidth: '130px' }}>Endereço</th>
            <th style={{ minWidth: '130px' }}>Evento</th>
            <th style={{ minWidth: '100px', textAlign: 'center' }}>Frequência</th>
            {DIAS_KEYS.map(d => <th key={d} style={{ textAlign: 'center' }}>{d}</th>)}
            <th style={{ width: '60px', textAlign: 'center' }}>Ações</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, itemIdx) => {
            const communityBg = itemIdx % 2 === 0
              ? { row: '#bfdbfe', border: '#3b82f6', name: '#1e3a8a' }   // azul
              : { row: '#86efac', border: '#16a34a', name: '#14532d' };  // verde
            const schedules = item.mass_schedules || {};
            const getHorarios = (ev) => schedules[ev]?.horarios || (typeof schedules[ev] === 'object' && !Array.isArray(schedules[ev]) ? schedules[ev] : {});
            const EVENT_PRIORITY = { 'Missa': 0, 'Celebração': 1 };
            const eventNames = Object.keys(schedules).sort((a, b) => {
              const pa = EVENT_PRIORITY[a] ?? 2;
              const pb = EVENT_PRIORITY[b] ?? 2;
              if (pa !== pb) return pa - pb;
              const earliest = (ev) => {
                const times = Object.values(getHorarios(ev)).filter(t => t && typeof t === 'string' && t !== '-');
                return times.length ? times.sort()[0] : '99:99';
              };
              return earliest(a).localeCompare(earliest(b));
            });
            if (eventNames.length === 0) {
              return (
                <tr key={item.id} style={{ background: communityBg.row }}>
                  <td style={{ fontWeight: 600, verticalAlign: 'middle', whiteSpace: 'nowrap', borderRight: `2px solid ${communityBg.border}`, color: communityBg.name }}>
                    <div>{item.name}</div>
                    <div style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', minHeight: '1em' }}>{parseAddress(item.address).bairro}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle', borderRight: `2px solid ${communityBg.border}` }}>
                    <div><AddressLink address={item.address} /></div>
                    <div style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', minHeight: '1em' }}>
                      {[item.cep ? item.cep.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : '', parseAddress(item.address).bairro].filter(Boolean).join(' — ')}
                    </div>
                  </td>
                  <td colSpan={9} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Sem programação cadastrada</td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button title="Editar" onClick={() => onEdit && onEdit(item)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                      onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    ><Pencil size={14} /></button>
                    <button title="Excluir" onClick={() => onDelete && onDelete(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                      onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    ><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            }
            return eventNames.map((evNome, evIdx) => (
              <tr key={`${item.id}-${evIdx}`} style={{ background: communityBg.row }}>
                {evIdx === 0 && (
                  <>
                    <td rowSpan={eventNames.length} style={{ fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap', color: communityBg.name }}>
                      <div>{item.name}</div>
                      <div style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', minHeight: '1em' }}>{parseAddress(item.address).bairro}</div>
                    </td>
                    <td rowSpan={eventNames.length} style={{ verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                      <div><AddressLink address={item.address} /></div>
                      <div style={{ fontWeight: 400, fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', minHeight: '1em' }}>{item.cep ? item.cep.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : ''}</div>
                    </td>
                  </>
                )}
                <td style={{ fontWeight: 500, color: communityBg.name }}>{evNome}</td>
                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const FREQ_ORDER = ['1ª', '2ª', '3ª', '4ª', '5ª'];
                    const freq = (schedules[evNome]?.frequencia || []).slice().sort((a, b) => FREQ_ORDER.indexOf(a) - FREQ_ORDER.indexOf(b));
                    if (!freq.length) return <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>;
                    return freq.map(f => (
                      <span key={f} style={{
                        display: 'inline-block', margin: '1px 2px',
                        padding: '1px 5px', borderRadius: '4px',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: communityBg.border,
                        color: '#fff'
                      }}>{f}</span>
                    ));
                  })()}
                </td>
                {DIAS_KEYS.map(d => (
                  <td key={d} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {getHorarios(evNome)[d] || '-'}
                  </td>
                ))}
                {evIdx === 0 && (
                  <td rowSpan={eventNames.length} style={{ textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <button title="Editar" onClick={() => onEdit && onEdit(item)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                      onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    ><Pencil size={14} /></button>
                    <button title="Excluir" onClick={() => onDelete && onDelete(item.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0.2rem 0.3rem', borderRadius: '4px' }}
                      onMouseOver={e => e.currentTarget.style.background = '#fee2e2'}
                      onMouseOut={e => e.currentTarget.style.background = 'none'}
                    ><Trash2 size={14} /></button>
                  </td>
                )}
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function CadastroForm({ setActiveMenu }) {
  return (
    <div className="grid-container" style={{ padding: '2rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
          <Users size={40} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
          <h4 style={{ marginBottom: '0.5rem' }}>Novo Servidor</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Coroinhas, Acólitos ou Monitores.</p>
          <button onClick={() => setActiveMenu('CadastroServidor')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Acessar Formulário</button>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
          <Church size={40} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
          <h4 style={{ marginBottom: '0.5rem' }}>Nova Comunidade</h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>Cadastro de paróquias e capelas.</p>
          <button onClick={() => setActiveMenu('CadastroComunidade')} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Acessar Formulário</button>
        </div>

      </div>
    </div>
  );
}
function CadastroServidorForm({ onBack, onSaved, editData, communities = [], initialType = 'Coroinhas', setHeaderExtra }) {
  const isEdit = !!editData;
  const MENU_TO_TYPE = { 'Coroinhas': 'coroinha', 'Acolitos': 'acolito', 'Monitores': 'monitor', 'Cerimoniários': 'cerimoniario', 'Coordenadores': 'coordenador' };
  const TIPO_KEY = { 'Coroinha': 'coroinha', 'Acólito': 'acolito', 'Monitor': 'monitor', 'Cerimoniário': 'cerimoniario', 'Coordenador': 'coordenador' };
  const SACR_KEY = { 'Batismo': 'batismo', 'Eucaristia': 'primeira_eucaristia', 'Crisma': 'crisma', 'Matrimônio': 'matrimonio' };
  const SACR_LABELS = ['Batismo', 'Eucaristia', 'Crisma', 'Matrimônio'];
  const INV_LABELS = ['Coroinha', 'Acólito'];
  const INV_KEY = { 'Coroinha': 'coroinha', 'Acólito': 'acolito' };

  const [form, setForm] = useState({
    cadastro: '', email: '', nome: '', dob: '', phone: '',
    guardian_mae: '', guardian_mae_phone: '',
    guardian_pai: '', guardian_pai_phone: '',
    guardian_outro: '', guardian_outro_phone: '',
    address: '', observations: '', schedule_notes: ''
  });
  const tipoInicial = MENU_TO_TYPE[initialType] || 'coroinha';
  const [tipos, setTipos] = useState(() => {
    const t = { coroinha: false, acolito: false, monitor: false, cerimoniario: false, coordenador: false };
    t[tipoInicial] = true;
    return t;
  });
  const enderecoVazio = () => ({ cep: '', rua: '', numero: '', bairrocidade: '' });
  const [enderecos, setEnderecos] = useState({ residencia: enderecoVazio() });
  const setEndereco = (tipo, field, val) => setEnderecos(prev => ({ ...prev, [tipo]: { ...prev[tipo], [field]: val } }));
  const [communityAtua, setCommunityAtua] = useState([]);
  // Participação na programação anual: { [nomeComunidade]: ['DOW|hora|semana', ...] }
  const [participation, setParticipation] = useState({});
  const dirtyRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; };
  const [autoStatus, setAutoStatus] = useState('');
  const toggleCommunityAtua = (name) => {
    markDirty();
    setCommunityAtua(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };
  const changeParticipation = (commName, key) => {
    markDirty();
    setParticipation(prev => {
      const cur = new Set(prev[commName] || []);
      cur.has(key) ? cur.delete(key) : cur.add(key);
      return { ...prev, [commName]: [...cur] };
    });
  };
  const formatCep = (digits) => digits.length >= 5 ? digits.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2-$3') : digits;
  const [transferOpen, setTransferOpen] = useState(false);
  const composeAddress = (e) => [e.rua, e.numero ? `Nº ${e.numero}` : '', e.bairrocidade, e.cep ? `CEP ${e.cep}` : ''].filter(Boolean).join(' - ');
  const [saving, setSaving] = useState(false);

  const sacrVazio = () => ({ received: false, date: '' });
  const invVazio  = () => ({ received: false, date: '' });
  const [sacraments, setSacraments] = useState({ batismo: sacrVazio(), primeira_eucaristia: sacrVazio(), crisma: sacrVazio(), matrimonio: sacrVazio() });
  const [investitures, setInvestitures] = useState({ coroinha: invVazio(), acolito: invVazio() });
  const setSacr = (key, field, val) => { markDirty(); setSacraments(p => ({ ...p, [key]: { ...p[key], [field]: val } })); };
  const setInv  = (key, field, val) => { markDirty(); setInvestitures(p => ({ ...p, [key]: { ...p[key], [field]: val } })); };

  // Pre-fill when editing
  useEffect(() => {
    if (editData) {
      let guardians = { mae: { nome: '', phone: '' }, pai: { nome: '', phone: '' }, outro: { nome: '', phone: '' } };
      try { const p = JSON.parse(editData.guardian_name || 'null'); if (p && typeof p === 'object' && p.mae) guardians = p; }
      catch { guardians.mae = { nome: editData.guardian_name || '', phone: editData.guardian_phone || '' }; }
      setForm({
        cadastro: editData.cadastro || '',
        email: editData.email || '',
        nome: editData.full_name || '',
        dob: editData.dob || '',
        phone: editData.phone || '',
        guardian_mae: guardians.mae?.nome || '',
        guardian_mae_phone: guardians.mae?.phone || '',
        guardian_pai: guardians.pai?.nome || '',
        guardian_pai_phone: guardians.pai?.phone || '',
        guardian_outro: guardians.outro?.nome || '',
        guardian_outro_phone: guardians.outro?.phone || '',
        address: editData.address || '',
        observations: editData.observations || '',
        schedule_notes: editData.schedule_notes || ''
      });
      // Load all roles for this person via person_id
      const loadAllRoles = async () => {
        if (editData.person_id) {
          const { data: siblings } = await supabase.from('servers').select('type').eq('person_id', editData.person_id);
          if (siblings) {
            const newTipos = { coroinha: false, acolito: false, monitor: false, cerimoniario: false, coordenador: false };
            siblings.forEach(r => { if (r.type) newTipos[r.type] = true; });
            setTipos(newTipos);
          }
        } else {
          setTipos(p => ({ ...p, [editData.type]: true }));
        }
      };
      loadAllRoles();

      // Parse stored address back into fields (o CEP fica no final: "... - CEP 17.700-000")
      const addrParts = (editData.address || '').split(' - ');
      let cepPart = '';
      if (addrParts.length && /^CEP\s/i.test(addrParts[addrParts.length - 1].trim())) {
        cepPart = addrParts.pop().trim().replace(/^CEP\s*/i, '');
      }
      const ruaPart = addrParts[0]?.trim() || '';
      const numPart = addrParts[1]?.replace('Nº ', '') || '';
      const bairroPart = addrParts.slice(2).join(' - ').trim() || '';
      setEnderecos(p => ({ ...p, residencia: { cep: cepPart, rua: ruaPart, numero: numPart, bairrocidade: bairroPart } }));
      try { setCommunityAtua(JSON.parse(editData.community_atua || '[]')); } catch { setCommunityAtua([]); }
      try { const p = JSON.parse(editData.participation || '{}'); setParticipation(p && typeof p === 'object' ? p : {}); } catch { setParticipation({}); }

      // Load sacraments from DB
      supabase.from('server_sacraments').select('*').eq('server_id', editData.id).then(({ data }) => {
        if (data) {
          const s = { batismo: sacrVazio(), primeira_eucaristia: sacrVazio(), crisma: sacrVazio(), matrimonio: sacrVazio() };
          data.forEach(r => { if (r.type) s[r.type] = { received: r.received ?? false, date: r.date || '' }; });
          setSacraments(s);
        }
      });

      // Load investitures from DB
      supabase.from('server_investitures').select('*').eq('server_id', editData.id).then(({ data }) => {
        if (data) {
          const inv = { coroinha: invVazio(), acolito: invVazio() };
          data.forEach(r => { if (r.type) inv[r.type] = { received: true, date: r.date || '' }; });
          setInvestitures(inv);
        }
      });
    }
  }, [editData]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const buscarCEP = async (cep, tipo) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setEnderecos(prev => ({
            ...prev,
            [tipo]: {
              ...prev[tipo],
              cep: formatCep(cepLimpo),
              rua: data.logradouro || '',
              bairrocidade: `${data.bairro}, ${data.localidade} - ${data.uf}`
            }
          }));
        } else {
          setEnderecos(prev => ({ ...prev, [tipo]: { ...prev[tipo], rua: 'CEP não encontrado', bairrocidade: '' } }));
        }
      } catch (error) { console.error('Erro CEP:', error); }
    }
  };

  const handleCepChange = (e, tipo) => {
    const digits = e.target.value.replace(/\D/g, '');
    setEndereco(tipo, 'cep', formatCep(digits));
    if (digits.length === 8) buscarCEP(e.target.value, tipo);
  };

  const handlePhoneMask = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.substring(0, 11);
    if (value.length > 10) value = value.replace(/^(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    else if (value.length > 6) value = value.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    else if (value.length > 2) value = value.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    else if (value.length > 0) value = value.replace(/^(\d*)/, '($1');
    e.target.value = value;
  };

  // Save sacraments and investitures for a given server_id
  const saveSacramentsAndInvestitures = async (serverId) => {
    await supabase.from('server_sacraments').delete().eq('server_id', serverId);
    const sacrRows = Object.entries(sacraments)
      .filter(([, v]) => v.received || v.date)
      .map(([type, v]) => ({ server_id: serverId, type, date: v.date || null, received: v.received }));
    if (sacrRows.length > 0) await supabase.from('server_sacraments').insert(sacrRows);

    await supabase.from('server_investitures').delete().eq('server_id', serverId);
    const invRows = Object.entries(investitures)
      .filter(([, v]) => v.received || v.date)
      .map(([type, v]) => ({ server_id: serverId, type, date: v.date || null }));
    if (invRows.length > 0) await supabase.from('server_investitures').insert(invRows);
  };

  // Insert tolerante: se a coluna "participation" ainda não existir no banco, regrava sem ela.
  const insertServerRow = async (row) => {
    let current = row;
    let res = await supabase.from('servers').insert(current).select('id').single();
    if (res.error && /participation/i.test(res.error.message)) {
      const { participation: _omit, ...rest } = current;
      current = rest;
      res = await supabase.from('servers').insert(current).select('id').single();
    }
    if (res.error && /email/i.test(res.error.message)) {
      const { email: _omit, ...rest } = current;
      current = rest;
      res = await supabase.from('servers').insert(current).select('id').single();
    }
    return res;
  };

  // Gravação automática: qualquer campo de seleção assinalado é salvo no banco (apenas em edição;
  // em cadastro novo as seleções são gravadas junto com o "Salvar Cadastro").
  useEffect(() => {
    if (!isEdit || !dirtyRef.current) return;
    const t = setTimeout(async () => {
      dirtyRef.current = false;
      setAutoStatus('saving');
      try {
        const col = editData.person_id ? 'person_id' : 'id';
        const val = editData.person_id || editData.id;
        const payload = {
          community_atua: communityAtua.length ? JSON.stringify(communityAtua) : null,
          participation: Object.keys(participation).length ? JSON.stringify(participation) : null
        };
        let { error } = await supabase.from('servers').update(payload).eq(col, val);
        if (error && /participation/i.test(error.message)) {
          const { participation: _p, ...rest } = payload;
          ({ error } = await supabase.from('servers').update(rest).eq(col, val));
        }
        if (error) throw error;
        const { data: sibs } = await supabase.from('servers').select('id').eq(col, val);
        for (const s of (sibs || [])) await saveSacramentsAndInvestitures(s.id);
        setAutoStatus('saved');
        setTimeout(() => setAutoStatus(s => s === 'saved' ? '' : s), 2500);
      } catch (e) {
        console.error('Auto-save:', e);
        setAutoStatus('');
      }
    }, 700);
    return () => clearTimeout(t);
  }, [communityAtua, participation, sacraments, investitures]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cria o login (e-mail+senha) do servidor a partir do próprio cadastro, sem
  // exigir o processo manual no painel do Supabase: se o cadastro ainda não
  // tem um perfil vinculado, cria a conta com senha determinística por função
  // (usando um client separado para não substituir a sessão do coordenador).
  // Coroinha/Acólito: Altar@cadastro. Monitor/Cerimoniário/Coordenador:
  // PrimeiroNome@cadastro — e Coordenador grava em coordenador_profiles
  // (acesso total) em vez de servidor_profiles.
  const provisionarAcessoServidor = async (tiposSelecionados = []) => {
    const email = form.email.trim();
    const cadastro = form.cadastro.trim();
    if (!email || !cadastro) return;
    try {
      const NIVEL_AMPLO = ['monitor', 'cerimoniario', 'coordenador'];
      const ehCoordenadorNovo = tiposSelecionados.includes('coordenador');
      const ehAmplo = tiposSelecionados.some(t => NIVEL_AMPLO.includes(t));
      const primeiroNome = form.nome.trim().split(/\s+/)[0] || '';
      const senhaTemp = ehAmplo ? `${primeiroNome}@${cadastro}` : `Altar@${cadastro}`;
      const tabelaPerfil = ehCoordenadorNovo ? 'coordenador_profiles' : 'servidor_profiles';

      const { data: existente, error: checkErr } = await supabase
        .from(tabelaPerfil).select('id').eq('numero_cadastro', cadastro).maybeSingle();
      if (checkErr) throw checkErr;

      if (existente) {
        const { error: updErr } = await supabase.from(tabelaPerfil).update({ email }).eq('id', existente.id);
        if (updErr) console.error('Erro ao atualizar e-mail do perfil:', updErr);
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabaseAuthOnly.auth.signUp({ email, password: senhaTemp });
      if (signUpErr) { alert('Não foi possível criar o login: ' + signUpErr.message); return; }

      const novoId = signUpData?.user?.id;
      if (!novoId) { alert('Conta criada, mas não foi possível concluir o vínculo do perfil.'); return; }

      const payloadPerfil = ehCoordenadorNovo
        ? { id: novoId, numero_cadastro: cadastro, full_name: form.nome.trim(), email, perfil: 'coordenador' }
        : { id: novoId, numero_cadastro: cadastro, full_name: form.nome.trim(), email, perfil: 'servidor' };

      const { error: profErr } = await supabase.from(tabelaPerfil).insert(payloadPerfil);
      if (profErr) { alert('Login criado, mas houve erro ao vincular o perfil: ' + profErr.message); return; }

      alert(`Login criado para ${form.nome.trim()}!\n\nE-mail: ${email}\nSenha temporária: ${senhaTemp}\n\nRepasse esses dados ao servidor. Ele pode trocar a senha depois em "Esqueci minha senha".`);
    } catch (err) {
      console.error('Erro ao provisionar acesso:', err);
      alert('Erro ao configurar o acesso do servidor: ' + err.message);
    }
  };

  const handleSalvar = async (tiposOverride) => {
    if (!form.nome.trim()) { alert('Informe o nome do servidor.'); return; }
    setSaving(true);
    try {
      const tiposSelecionados = Array.isArray(tiposOverride)
        ? [...tiposOverride]
        : Object.entries(tipos).filter(([, v]) => v).map(([k]) => k);
      if (tiposSelecionados.length === 0) tiposSelecionados.push(tipoInicial);

      if (isEdit) {
        // UPDATE: delete all records for this person, re-insert with new types
        const personId = editData.person_id || editData.id;
        const deleteQuery = editData.person_id
          ? supabase.from('servers').delete().eq('person_id', personId)
          : supabase.from('servers').delete().eq('id', editData.id);
        const { error: delErr } = await deleteQuery;
        if (delErr) { alert('Erro ao atualizar: ' + delErr.message); return; }

        const commonData = {
          person_id: personId,
          cadastro: form.cadastro || null,
          email: form.email.trim() || null,
          full_name: form.nome.trim(),
          dob: form.dob || null,
          phone: form.phone || null,
          guardian_name: JSON.stringify({ mae: { nome: form.guardian_mae, phone: form.guardian_mae_phone }, pai: { nome: form.guardian_pai, phone: form.guardian_pai_phone }, outro: { nome: form.guardian_outro, phone: form.guardian_outro_phone } }),
          guardian_phone: form.guardian_mae_phone || form.guardian_pai_phone || form.guardian_outro_phone || null,
          address: composeAddress(enderecos.residencia) || null,
          community_atua: communityAtua.length ? JSON.stringify(communityAtua) : null,
          observations: form.observations || null,
          schedule_notes: form.schedule_notes || null,
          participation: Object.keys(participation).length ? JSON.stringify(participation) : null
        };
        const results = await Promise.all(tiposSelecionados.map(tipo =>
          insertServerRow({ ...commonData, type: tipo })
        ));
        const erros = results.filter(r => r.error);
        if (erros.length > 0) { alert('Erro ao atualizar: ' + erros[0].error.message); }
        else {
          for (const r of results) {
            if (r.data?.id) await saveSacramentsAndInvestitures(r.data.id);
          }
          await provisionarAcessoServidor(tiposSelecionados);
          alert('Servidor atualizado com sucesso!'); if (onSaved) onSaved();
        }
      } else {
        // INSERT: generate shared person_id for all roles
        const personId = crypto.randomUUID();
        const commonData = {
          person_id: personId,
          cadastro: form.cadastro || null,
          email: form.email.trim() || null,
          full_name: form.nome.trim(),
          dob: form.dob || null,
          phone: form.phone || null,
          guardian_name: JSON.stringify({ mae: { nome: form.guardian_mae, phone: form.guardian_mae_phone }, pai: { nome: form.guardian_pai, phone: form.guardian_pai_phone }, outro: { nome: form.guardian_outro, phone: form.guardian_outro_phone } }),
          guardian_phone: form.guardian_mae_phone || form.guardian_pai_phone || form.guardian_outro_phone || null,
          address: composeAddress(enderecos.residencia) || null,
          community_atua: communityAtua.length ? JSON.stringify(communityAtua) : null,
          observations: form.observations || null,
          schedule_notes: form.schedule_notes || null,
          participation: Object.keys(participation).length ? JSON.stringify(participation) : null
        };
        const results = await Promise.all(tiposSelecionados.map(tipo =>
          insertServerRow({ ...commonData, type: tipo })
        ));
        const erros = results.filter(r => r.error);
        if (erros.length > 0) { alert('Erro ao salvar: ' + erros[0].error.message); }
        else {
          for (const r of results) {
            if (r.data?.id) await saveSacramentsAndInvestitures(r.data.id);
          }
          await provisionarAcessoServidor(tiposSelecionados);
          alert('Servidor cadastrado com sucesso!'); if (onSaved) onSaved();
        }
      }
    } finally { setSaving(false); }
  };

  // Injeta os botões de ação do formulário na primeira linha do cabeçalho do
  // app (ao lado de Usuário/Função/E-mail/Sair), em vez de uma segunda linha.
  useEffect(() => {
    if (!setHeaderExtra) return;
    setHeaderExtra(
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <button type="button" onClick={onBack} className="btn-primary" style={{ backgroundColor: 'var(--text-muted)' }}>Cancelar / Voltar</button>
        <button type="button" onClick={handleSalvar} disabled={saving} className="btn-primary">{saving ? 'Salvando...' : isEdit ? 'Atualizar Servidor' : 'Salvar Cadastro'}</button>
        {isEdit && (
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setTransferOpen(o => !o)} disabled={saving}
              className="btn-primary" style={{ backgroundColor: '#7c3aed' }}>
              Transferência para outro cadastro ▾
            </button>
            {transferOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 60, background: '#fff',
                border: '1px solid #cbd5e1', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                minWidth: '220px', overflow: 'hidden', marginTop: '0.2rem' }}>
                {[['coroinha', 'Coroinha'], ['acolito', 'Acólito'], ['monitor', 'Monitor']].map(([k, label]) => (
                  <button key={k} type="button"
                    onClick={async () => {
                      setTransferOpen(false);
                      if (!window.confirm(`Transferir ${form.nome || 'este servidor'} para ${label}?\nTodos os dados do cadastro serão mantidos na nova função.`)) return;
                      setTipos({ coroinha: false, acolito: false, monitor: false, cerimoniario: false, coordenador: false, [k]: true });
                      await handleSalvar([k]);
                    }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600, color: '#334155' }}
                    onMouseOver={e => e.currentTarget.style.background = '#ede9fe'}
                    onMouseOut={e => e.currentTarget.style.background = 'none'}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
    return () => setHeaderExtra(null);
  }, [onBack, handleSalvar, saving, isEdit, transferOpen, form.nome]);

  return (
    <div className="grid-container" style={{ padding: '0 2rem 2rem 2rem', backgroundColor: 'var(--surface)' }}>
      <form className="cadastro-form" onSubmit={(e) => e.preventDefault()}>

        {/* Row 1: Cadastro + Nome */}
        <div style={{ background: 'linear-gradient(to right, #eff6ff, #dbeafe)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div className="form-group-inline" style={{ flex: 'none' }}>
              <label style={{ color: '#1e3a8a' }}>Cadastro:</label>
              <input type="text" className="form-input" maxLength={6} style={{ background: 'rgba(255,255,255,0.8)', width: '8ch', flex: 'none' }} placeholder="Nº cadastro" value={form.cadastro} onChange={e => setF('cadastro', e.target.value)} />
            </div>
            <div className="form-group-inline" style={{ flex: 'none' }}>
              <label style={{ color: '#1e3a8a' }}>Nome:</label>
              <input type="text" className="form-input" maxLength={50} style={{ background: 'rgba(255,255,255,0.8)', width: '50ch', flex: 'none' }} value={form.nome} onChange={e => setF('nome', e.target.value)} />
            </div>
            <div className="form-group-inline" style={{ flex: 'none' }}>
              <label style={{ color: '#1e3a8a' }}>Nascimento:</label>
              <input type="date" className="form-input" style={{ background: 'rgba(255,255,255,0.8)', width: '15ch', flex: 'none' }} value={form.dob} onChange={e => setF('dob', e.target.value)} />
            </div>
            <div className="form-group-inline" style={{ flex: 'none' }}>
              <label style={{ color: '#1e3a8a' }}>WhatsApp:</label>
              <input type="text" className="form-input" maxLength={15} style={{ background: 'rgba(255,255,255,0.8)', width: '17ch', flex: 'none' }} placeholder="(11) 99999-9999" value={form.phone} onChange={e => { handlePhoneMask(e); setF('phone', e.target.value); }} />
            </div>
            <div className="form-group-inline" style={{ flex: '1' }}>
              <label style={{ color: '#1e3a8a' }}>E-mail de acesso:</label>
              <input type="email" className="form-input" maxLength={40} style={{ background: 'rgba(255,255,255,0.8)' }} placeholder="email@exemplo.com" value={form.email} onChange={e => setF('email', e.target.value)} />
            </div>
          </div>
        </div>
        
        {/* Row 2: Residência */}
        <div style={{ background: 'linear-gradient(to right, #f0fdf4, #dcfce7)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: '#14532d', fontWeight: 600, fontSize: '0.82rem', minWidth: '70px' }}>Residência:</span>
            <input type="text" className="form-input"
              style={{ width: '105px', background: 'rgba(255,255,255,0.8)', flexShrink: 0 }}
              placeholder="00.000-000"
              value={enderecos.residencia.cep}
              onChange={e => handleCepChange(e, 'residencia')}
              onBlur={e => buscarCEP(e.target.value, 'residencia')}
              maxLength={10}
            />
            <input type="text" className="form-input" readOnly value={enderecos.residencia.rua}
              placeholder="Rua" style={{ flex: '3', minWidth: '140px', backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <input type="text" className="form-input"
              style={{ width: '64px', background: 'rgba(255,255,255,0.8)', flexShrink: 0 }}
              placeholder="Nº" value={enderecos.residencia.numero}
              onChange={e => setEndereco('residencia', 'numero', e.target.value)} />
            <input type="text" className="form-input" readOnly value={enderecos.residencia.bairrocidade}
              placeholder="Bairro, Cidade - UF" style={{ flex: '4', minWidth: '160px', backgroundColor: 'rgba(255,255,255,0.5)' }} />
          </div>
        </div>

        {/* Rows 3-5: Responsáveis (apenas para Coroinha, Acólito e Cerimoniário) */}
        {!['monitor', 'coordenador'].includes(tipoInicial) && [
          { label: 'Responsável (Mãe):', nomeKey: 'guardian_mae', phoneKey: 'guardian_mae_phone' },
          { label: 'Responsável (Pai):', nomeKey: 'guardian_pai', phoneKey: 'guardian_pai_phone' },
          { label: 'Responsável (Outro):', nomeKey: 'guardian_outro', phoneKey: 'guardian_outro_phone' },
        ].map(({ label, nomeKey, phoneKey }) => (
          <div key={nomeKey} style={{ background: 'linear-gradient(to right, #fffbeb, #fef3c7)', padding: '0.4rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="form-group-inline" style={{ flex: '3' }}>
                <label style={{ color: '#78350f', whiteSpace: 'nowrap' }}>{label}</label>
                <input type="text" className="form-input" style={{ background: 'rgba(255,255,255,0.8)' }} value={form[nomeKey]} onChange={e => setF(nomeKey, e.target.value)} />
              </div>
              <div className="form-group-inline" style={{ flex: '1.5' }}>
                <label style={{ color: '#78350f' }}>WhatsApp:</label>
                <input type="text" className="form-input" style={{ background: 'rgba(255,255,255,0.8)' }} placeholder="(11) 99999-9999" value={form[phoneKey]} onChange={e => { handlePhoneMask(e); setF(phoneKey, e.target.value); }} />
              </div>
            </div>
          </div>
        ))}

        {/* Sacramentos+Investidura | Comunidade que Atua (2 colunas) — 3 colunas */}
        <div style={{ background: 'linear-gradient(to right, #f5f3ff, #ede9fe)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', alignItems: 'start' }}>

            {/* Coluna 1: Sacramentos + Investidura */}
            <div>
            <table className="form-table" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #ddd6fe', width: '100%', marginBottom: '1rem' }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#ddd6fe', width: '52px', textAlign: 'center', color: '#4c1d95', borderColor: '#c4b5fd' }}>Rec.?</th>
                  <th style={{ backgroundColor: '#ddd6fe', textAlign: 'left', color: '#4c1d95', borderColor: '#c4b5fd' }}>Sacramentos:</th>
                  <th style={{ backgroundColor: '#ddd6fe', width: '120px', color: '#4c1d95', borderColor: '#c4b5fd' }}>Data:</th>
                </tr>
              </thead>
              <tbody>
                {SACR_LABELS.map((label) => {
                  const key = SACR_KEY[label];
                  return (
                    <tr key={key}>
                      <td style={{ borderColor: '#e4d8eb', textAlign: 'center' }}>
                        <input type="checkbox" checked={sacraments[key]?.received || false}
                          onChange={e => setSacr(key, 'received', e.target.checked)}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#7c3aed' }} />
                      </td>
                      <td style={{ borderColor: '#e4d8eb', fontWeight: 500, color: '#4c1d95', fontSize: '0.82rem' }}>{label}</td>
                      <td style={{ borderColor: '#e4d8eb' }}>
                        <input type="date" className="form-input-invisible"
                          value={sacraments[key]?.date || ''}
                          onChange={e => setSacr(key, 'date', e.target.value)}
                          style={{ width: '100%', fontSize: '0.8rem' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Investidura logo abaixo dos Sacramentos, na mesma coluna */}
            <table className="form-table" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #ddd6fe', width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ backgroundColor: '#ddd6fe', width: '52px', textAlign: 'center', color: '#4c1d95', borderColor: '#c4b5fd' }}>Rec.?</th>
                  <th style={{ backgroundColor: '#ddd6fe', textAlign: 'left', color: '#4c1d95', borderColor: '#c4b5fd' }}>Investidura:</th>
                  <th style={{ backgroundColor: '#ddd6fe', width: '120px', color: '#4c1d95', borderColor: '#c4b5fd' }}>Data:</th>
                </tr>
              </thead>
              <tbody>
                {INV_LABELS.map((label) => {
                  const key = INV_KEY[label];
                  return (
                    <tr key={key}>
                      <td style={{ borderColor: '#e4d8eb', textAlign: 'center' }}>
                        <input type="checkbox" checked={investitures[key]?.received || false}
                          onChange={e => setInv(key, 'received', e.target.checked)}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#7c3aed' }} />
                      </td>
                      <td style={{ borderColor: '#e4d8eb', fontWeight: 500, color: '#4c1d95', fontSize: '0.82rem' }}>{label}</td>
                      <td style={{ borderColor: '#e4d8eb' }}>
                        <input type="date" className="form-input-invisible"
                          value={investitures[key]?.date || ''}
                          onChange={e => setInv(key, 'date', e.target.value)}
                          style={{ width: '100%', fontSize: '0.8rem' }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Colunas 2 e 3: Comunidade que Atua dividida em duas colunas */}
            {(() => {
              const metade = Math.ceil(communities.length / 2);
              const colunas = [communities.slice(0, metade), communities.slice(metade)];
              return colunas.map((lista, ci) => (
                <table key={ci} className="form-table" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #ddd6fe', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ backgroundColor: '#ddd6fe', width: '44px', textAlign: 'center', color: '#4c1d95', borderColor: '#c4b5fd' }}>Sel.</th>
                      <th style={{ backgroundColor: '#ddd6fe', textAlign: 'left', color: '#4c1d95', borderColor: '#c4b5fd' }}>
                        {ci === 0 ? 'Comunidade que Atua:' : 'Comunidade que Atua (cont.):'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ci === 0 && communities.length === 0 ? (
                      <tr><td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', borderColor: '#e4d8eb' }}>Nenhuma cadastrada</td></tr>
                    ) : lista.map(c => (
                      <tr key={c.id}>
                        <td style={{ borderColor: '#e4d8eb', textAlign: 'center' }}>
                          <input type="checkbox"
                            checked={communityAtua.includes(c.name)}
                            onChange={() => toggleCommunityAtua(c.name)}
                            style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#7c3aed' }} />
                        </td>
                        <td style={{ borderColor: '#e4d8eb', fontWeight: 500, color: '#4c1d95', fontSize: '0.82rem' }}>{c.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ));
            })()}

          </div>
        </div>

        {/* Textareas */}
        <div style={{ background: 'linear-gradient(to right, #f8fafc, #f1f5f9)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
          <div className="form-section" style={{ marginBottom: '0.5rem' }}>
            <h3 style={{ padding: '0', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', color: '#334155' }}>
              Anotações: <span style={{ fontWeight: 'normal', fontSize: '0.8rem', color: 'var(--text-muted)' }}>(Espaço reservado para restrições alimentares, medicações de uso contínuo, prescrição médica, e outros)</span>
            </h3>
            <textarea className="form-input" rows="2" style={{ width: '100%', resize: 'vertical', background: 'rgba(255,255,255,0.8)' }}
              value={form.observations} onChange={e => setF('observations', e.target.value)}
            ></textarea>
          </div>

        </div>

        {/* Programação Anual: mostra automaticamente as comunidades marcadas em "Comunidade que Atua" */}
        <ProgramacaoAnual communities={communities} atuaNames={communityAtua}
          participation={participation} onToggleParticipation={changeParticipation} />

        {autoStatus && (
          <div style={{ position: 'fixed', bottom: '1rem', right: '1rem', zIndex: 90,
            background: autoStatus === 'saving' ? '#1e3a8a' : '#15803d', color: '#fff',
            padding: '0.45rem 0.9rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
            {autoStatus === 'saving' ? 'Gravando seleções…' : 'Seleções gravadas no banco ✓'}
          </div>
        )}

      </form>
    </div>
  );
}

// ─── Componente de Programação Mensal ──────────────────────────────────────
const DIAS_SEMANA_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const DIAS_SEMANA_FULL = { 'DOM': 'Domingo', 'SEG': 'Segunda-Feira', 'TER': 'Terça-Feira', 'QUA': 'Quarta-Feira', 'QUI': 'Quinta-Feira', 'SEX': 'Sexta-Feira', 'SAB': 'Sábado' };
const MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getNthWeekday(dayOfMonth) {
  // Returns which occurrence of its weekday this day is in the month (1st, 2nd, 3rd, 4th, 5th)
  return Math.ceil(dayOfMonth / 7);
}

function ProgramacaoAnual({ communities, atuaNames = [], participation = {}, onToggleParticipation }) {
  const now = new Date();
  const [selectedYear, setSelectedYear] = React.useState(now.getFullYear());
  const atuaComms = communities.filter(c => atuaNames.includes(c.name));

  return (
    <div style={{ background: 'linear-gradient(to right, #eff6ff, #dbeafe)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <CalendarDays size={16} /> Programação Anual
        </span>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '0.3rem 0.5rem', borderRadius: '4px', border: '1px solid #93c5fd', fontSize: '0.82rem', background: 'rgba(255,255,255,0.9)', color: '#1e3a8a', fontWeight: 600 }}>
          {[2025, 2026, 2027, 2028, 2029, 2030].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {atuaComms.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: '#64748b', padding: '1rem 0', textAlign: 'center' }}>
          Marque a(s) comunidade(s) em <strong>Comunidade que Atua</strong> — a programação de cada uma aparecerá aqui, aguardando a seleção do horário e da semana em que atua.
        </p>
      ) : atuaComms.map(c => (
        <ProgramacaoComunidade key={c.id} community={c} year={selectedYear}
          highlights={new Set(participation[c.name] || [])}
          onToggle={(key) => onToggleParticipation && onToggleParticipation(c.name, key)} />
      ))}
    </div>
  );
}

function ProgramacaoComunidade({ community, year, highlights, onToggle }) {
  const toggleHighlight = onToggle;

  const isRowHighlighted = (row) =>
    highlights.has(`${row.dow}|${row.time}|0`) ||
    highlights.has(`${row.dow}|${row.time}|${row.nth}`);

  const MESES_SHORT = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const DOW_ORDER = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
  const DOW_NUM   = { DOM:0, SEG:1, TER:2, QUA:3, QUI:4, SEX:5, SAB:6 };
  const ORDINAL   = (nth, dow) => {
    const suf = (dow === 'DOM' || dow === 'SAB') ? 'º' : 'ª';
    return `${nth}${suf} ${dow}`;
  };
  const FREQ_MAP  = { '1ª':1,'2ª':2,'3ª':3,'4ª':4,'5ª':5, '1ª semana':1,'2ª semana':2,'3ª semana':3,'4ª semana':4,'5ª semana':5 };

  // Returns the day-of-month for the nth occurrence of dow (0=Sun) in (year, month)
  // Returns null if that occurrence doesn't exist
  const nthDate = (year, month, nth, dow) => {
    const firstDow = new Date(year, month, 1).getDay();
    const first = 1 + ((dow - firstDow + 7) % 7);
    const d = first + (nth - 1) * 7;
    return d <= new Date(year, month + 1, 0).getDate() ? d : null;
  };

  // Build table rows from mass_schedules
  const rows = React.useMemo(() => {
    if (!community?.mass_schedules) return [];
    const ms = community.mass_schedules;
    if (Array.isArray(ms)) return [];

    const result = [];
    Object.entries(ms).forEach(([eventName, schedule]) => {
      const horarios = schedule.horarios || schedule;
      const freq = schedule.frequencia || schedule.frequency;
      const nths = (!freq || freq.length === 0)
        ? [1, 2, 3, 4, 5]
        : freq.map(f => FREQ_MAP[f]).filter(Boolean);

      DOW_ORDER.forEach(dow => {
        const rawTime = horarios[dow];
        if (!rawTime) return;
        const times = rawTime.split(',').map(t => t.trim()).filter(Boolean).sort();
        nths.forEach(nth => {
          times.forEach(time => {
            result.push({ eventName, nth, dow, time });
          });
        });
      });
    });

    // Sort: nth → DOW order → time
    result.sort((a, b) => {
      if (a.nth !== b.nth) return a.nth - b.nth;
      if (DOW_ORDER.indexOf(a.dow) !== DOW_ORDER.indexOf(b.dow))
        return DOW_ORDER.indexOf(a.dow) - DOW_ORDER.indexOf(b.dow);
      return a.time.localeCompare(b.time);
    });
    return result;
  }, [community]);

  // Opções do painel de destaque: combinações únicas de dow+time com seus nths
  const highlightOptions = React.useMemo(() => {
    const map = {};
    rows.forEach(r => {
      const key = `${r.dow}|${r.time}`;
      if (!map[key]) map[key] = { dow: r.dow, time: r.time, nths: new Set() };
      map[key].nths.add(r.nth);
    });
    return Object.values(map).sort((a, b) => {
      if (DOW_ORDER.indexOf(a.dow) !== DOW_ORDER.indexOf(b.dow))
        return DOW_ORDER.indexOf(a.dow) - DOW_ORDER.indexOf(b.dow);
      return a.time.localeCompare(b.time);
    });
  }, [rows]);

  const thStyle = (extra = {}) => ({
    background: '#1e3a8a', color: '#fff', border: '1px solid #1e40af',
    padding: '0.35rem 0.5rem', textAlign: 'center', fontWeight: 700,
    fontSize: '0.75rem', whiteSpace: 'nowrap', ...extra
  });

  const tdStyle = (extra = {}) => ({
    border: '1px solid #cbd5e1', padding: '0.22rem 0.4rem',
    textAlign: 'center', fontSize: '0.78rem', ...extra
  });

  return (
    <div style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid #93c5fd', borderRadius: '8px', padding: '0.5rem 0.8rem', marginBottom: '0.6rem' }}>
      <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#1e3a8a', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <Church size={14} /> {community.name}
        {highlights.size === 0 && (
          <span style={{ fontWeight: 500, fontSize: '0.74rem', color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '0.1rem 0.45rem' }}>
            aguardando seleção do horário e da semana
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: '#64748b', padding: '1rem 0', textAlign: 'center' }}>
          Nenhum evento cadastrado para esta comunidade.
        </p>
      ) : (
        <>
        {/* Painel de destaque de participação */}
        <div style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #93c5fd', borderRadius: '6px', padding: '0.5rem 0.8rem', marginBottom: '0.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.75rem', color: '#1e3a8a', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Destacar participação:
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {DOW_ORDER.map(dow => {
              // horários disponíveis para este dia
              const timesForDow = [...new Set(highlightOptions.filter(o => o.dow === dow).map(o => o.time))].sort();
              if (timesForDow.length === 0) return null;
              return (
                <div key={dow} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '0.3rem 0.5rem', minWidth: '90px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#1e40af', textAlign: 'center', marginBottom: '0.3rem', borderBottom: '1px solid #bfdbfe', paddingBottom: '0.2rem' }}>
                    {dow}
                  </div>
                  {timesForDow.map(time => {
                    const nthsPresent = [...new Set(rows.filter(r => r.dow === dow && r.time === time).map(r => r.nth))].sort();
                    return (
                      <div key={time} style={{ marginBottom: '0.3rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.74rem', color: '#334155', marginBottom: '0.15rem' }}>{time}</div>
                        {nthsPresent.map(n => {
                          const key = `${dow}|${time}|${n}`;
                          return (
                            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer', marginBottom: '0.08rem' }}>
                              <input type="checkbox" checked={highlights.has(key)} onChange={() => toggleHighlight(key)}
                                style={{ accentColor: '#15803d', cursor: 'pointer' }} />
                              {n}ª semana
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        {highlights.size === 0 ? (
          <p style={{ fontSize: '0.82rem', color: '#64748b', padding: '0.8rem 0', textAlign: 'center', background: 'rgba(255,255,255,0.6)', borderRadius: '4px', border: '1px dashed #93c5fd' }}>
            Selecione ao menos uma opção em <strong>Destacar participação</strong> para visualizar a programação.
          </p>
        ) : (
        <div style={{ overflowX: 'auto', maxHeight: '520px', overflowY: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={thStyle({ background: '#2563eb', minWidth: '100px' })}>EVENTO</th>
                <th style={thStyle({ background: '#2563eb', minWidth: '80px' })}>DIA</th>
                <th style={thStyle({ background: '#2563eb', minWidth: '52px' })}>HORAS</th>
                {MESES_SHORT.map(m => (
                  <th key={m} style={thStyle({ background: '#2563eb' })}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Paleta de cores por dia da semana (alternando dentro de cada grupo de semana)
                const DOW_COLORS = {
                  DOM: { bg: '#facc15', text: '#000000', numColor: '#000000' },
                  TER: { bg: '#facc15', text: '#000000', numColor: '#000000' },
                  QUI: { bg: '#facc15', text: '#000000', numColor: '#000000' },
                  SAB: { bg: '#facc15', text: '#000000', numColor: '#000000' },
                  SEG: { bg: '#3b82f6', text: '#000000', numColor: '#000000' },
                  QUA: { bg: '#3b82f6', text: '#000000', numColor: '#000000' },
                  SEX: { bg: '#3b82f6', text: '#000000', numColor: '#000000' },
                };

                const visibleRows = rows.filter(r => isRowHighlighted(r));
                return visibleRows.map((row, idx) => {
                  const prevRow = visibleRows[idx - 1];
                  const isNewGroup = !prevRow || prevRow.nth !== row.nth;
                  const colors = DOW_COLORS[row.dow] || DOW_COLORS.SEG;
                  const hl = isRowHighlighted(row);

                  return (
                    <React.Fragment key={idx}>
                      {isNewGroup && (
                        <tr>
                          <td colSpan={3 + 12} style={{
                            background: 'transparent', color: '#1e3a8a', fontWeight: 700,
                            fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em',
                            padding: '0.25rem 0.6rem', border: 'none', borderBottom: '1px solid #93c5fd'
                          }}>
                            {row.nth}ª Semana
                          </td>
                        </tr>
                      )}
                      <tr style={{ background: hl ? '#15803d' : colors.bg }}>
                        <td style={tdStyle({ fontWeight: 600, color: hl ? '#fff' : colors.text, whiteSpace: 'nowrap', background: 'inherit' })}>
                          {row.eventName}
                        </td>
                        <td style={tdStyle({ fontWeight: 700, color: hl ? '#fff' : colors.text, whiteSpace: 'nowrap', background: 'inherit' })}>
                          {ORDINAL(row.nth, row.dow)}
                        </td>
                        <td style={tdStyle({ fontWeight: hl ? 700 : 500, color: hl ? '#fff' : colors.text, background: 'inherit' })}>{row.time}</td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const d = nthDate(year, m, row.nth, DOW_NUM[row.dow]);
                          return (
                            <td key={m} style={tdStyle({
                              fontWeight: d ? 700 : 400,
                              color: hl ? (d ? '#fff' : 'rgba(255,255,255,0.25)') : (d ? colors.numColor : '#cbd5e1'),
                              background: 'inherit',
                            })}>
                              {d ?? '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
        )}
        </>
      )}
    </div>
  );
}

// ─── Formulário de Cadastro de Comunidade ──────────────────────────────────
const DIAS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB', 'DOM'];
const EVENTOS_PADRAO = ['Missa', 'Celebração'];

function CadastroComunidadeForm({ onBack, onSaved, editData }) {
  const isEdit = !!editData;
  const [nomeComun, setNomeComun] = React.useState('');
  const [endereco, setEnderecoComun] = React.useState({ cep: '', rua: '', numero: '', bairrocidade: '' });
  const setEC = (field, val) => setEnderecoComun(prev => ({ ...prev, [field]: val }));
  const formatCepC = (digits) => digits.length >= 5 ? digits.replace(/^(\d{2})(\d{3})(\d{0,3})/, '$1.$2-$3') : digits;
  const composeAddressComun = () => [endereco.rua, endereco.numero ? `Nº ${endereco.numero}` : '', endereco.bairrocidade].filter(Boolean).join(' - ');
  const eventoVazio = (nome = '') => ({ id: crypto.randomUUID(), nome, frequencia: [], horarios: { SEG: '', TER: '', QUA: '', QUI: '', SEX: '', SAB: '', DOM: '' } });
  // Missas sempre primeiro na lista de eventos; demais eventos mantêm a ordem em que foram criados
  const isMissa = (nome) => /^\s*missa/i.test(nome || '');
  const ordenarEventos = (arr) => [...arr].sort((a, b) => (isMissa(b.nome) ? 1 : 0) - (isMissa(a.nome) ? 1 : 0));
  const [eventos, setEventos] = React.useState(ordenarEventos(EVENTOS_PADRAO.map(nome => eventoVazio(nome))));
  const FREQ_OPCOES = ['1ª', '2ª', '3ª', '4ª', '5ª'];

  // Pre-fill when editing
  React.useEffect(() => {
    if (editData) {
      setNomeComun(editData.name || '');
      setEnderecoComun({ cep: editData.cep || '', rua: editData.address || '', numero: '', bairrocidade: '' });
      const ms = editData.mass_schedules || {};
      const evArr = Object.entries(ms).map(([nome, val]) => ({
        id: crypto.randomUUID(),
        nome,
        horarios: val.horarios || val,
        frequencia: val.frequencia || []
      }));
      if (evArr.length > 0) setEventos(ordenarEventos(evArr));
    }
  }, [editData]);

  const buscarCEP = async (cep) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setEnderecoComun(prev => ({
            ...prev,
            cep: formatCepC(cepLimpo),
            rua: data.logradouro || '',
            bairrocidade: `${data.bairro}, ${data.localidade} - ${data.uf}`
          }));
        } else {
          setEC('rua', 'CEP não encontrado');
        }
      } catch { setEC('rua', 'Erro ao buscar CEP'); }
    }
  };

  const handleHorario = (eventoIdx, dia, valor) => {
    setEventos(prev => prev.map((ev, i) =>
      i === eventoIdx ? { ...ev, horarios: { ...ev.horarios, [dia]: valor } } : ev
    ));
  };

  const handleNomeEvento = (eventoIdx, valor) => {
    setEventos(prev => prev.map((ev, i) =>
      i === eventoIdx ? { ...ev, nome: valor } : ev
    ));
  };

  const handleFrequencia = (eventoIdx, opcao) => {
    setEventos(prev => prev.map((ev, i) => {
      if (i !== eventoIdx) return ev;
      const atual = ev.frequencia || [];
      const nova = atual.includes(opcao) ? atual.filter(f => f !== opcao) : [...atual, opcao];
      return { ...ev, frequencia: nova };
    }));
  };

  const addEvento = () => {
    setEventos(prev => [...prev, eventoVazio()]);
  };

  const removeEvento = (idx) => {
    setEventos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSalvar = async () => {
    if (!nomeComun.trim()) { alert('Informe o nome da comunidade.'); return; }

    const mass_schedules = {};
    ordenarEventos(eventos).forEach(ev => {
      if (ev.nome.trim()) mass_schedules[ev.nome.trim()] = { horarios: ev.horarios, frequencia: ev.frequencia || [] };
    });

    if (isEdit) {
      const { error } = await supabase.from('communities').update({
        name: nomeComun.trim(),
        address: composeAddressComun() || null,
        cep: endereco.cep.replace(/\D/g, '') || null,
        mass_schedules
      }).eq('id', editData.id);
      if (error) { alert('Erro ao atualizar: ' + error.message); }
      else { alert('Comunidade atualizada com sucesso!'); if (onSaved) onSaved(); else onBack(); }
    } else {
      const { error } = await supabase.from('communities').insert({
        name: nomeComun.trim(),
        address: composeAddressComun() || null,
        cep: endereco.cep.replace(/\D/g, '') || null,
        mass_schedules
      });
      if (error) { alert('Erro ao salvar: ' + error.message); }
      else { alert('Comunidade cadastrada com sucesso!'); if (onSaved) onSaved(); else onBack(); }
    }
  };

  return (
    <div className="grid-container" style={{ padding: '0 2rem 2rem 2rem', backgroundColor: 'var(--surface)' }}>
      <form onSubmit={e => e.preventDefault()}>

        {/* Linha 1 — Nome e Endereço */}
        <div style={{ background: 'linear-gradient(to right, #eff6ff, #dbeafe)', padding: '0.5rem 1rem', border: '1px solid var(--border)', marginBottom: '0' }}>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.4rem' }}>
            <div className="form-group-inline" style={{ flex: '3' }}>
              <label style={{ color: '#1e3a8a' }}>Nome da Comunidade:</label>
              <input type="text" className="form-input" style={{ background: 'rgba(255,255,255,0.85)' }} placeholder="Ex: Paróquia São José" value={nomeComun} onChange={e => setNomeComun(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
            <input
              type="text" className="form-input"
              style={{ width: '105px', background: 'rgba(255,255,255,0.85)', flexShrink: 0 }}
              placeholder="00.000-000"
              value={endereco.cep}
              onChange={e => { const d = e.target.value.replace(/\D/g,''); setEC('cep', formatCepC(d)); if (d.length === 8) buscarCEP(e.target.value); }}
              onBlur={e => buscarCEP(e.target.value)}
              maxLength={10}
            />
            <input type="text" className="form-input" readOnly value={endereco.bairrocidade}
              placeholder="Bairro, Cidade - UF"
              style={{ flex: '1', minWidth: '160px', backgroundColor: 'rgba(255,255,255,0.5)' }} />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" className="form-input" readOnly value={endereco.rua}
              placeholder="Rua"
              style={{ flex: '1', minWidth: '140px', backgroundColor: 'rgba(255,255,255,0.5)' }} />
            <input type="text" className="form-input"
              style={{ width: '64px', background: 'rgba(255,255,255,0.85)', flexShrink: 0 }}
              placeholder="Nº"
              value={endereco.numero}
              onChange={e => setEC('numero', e.target.value)} />
          </div>
        </div>

        {/* Linha 2 — Tabela de Eventos por Dia da Semana */}
        <div style={{ background: 'linear-gradient(to right, #f0fdf4, #dcfce7)', padding: '0.5rem 1rem', border: '1px solid var(--border)', borderTop: 'none', marginBottom: '0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#14532d', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Programação Semanal
            </span>
            <button
              type="button"
              onClick={addEvento}
              style={{ background: 'rgba(20,83,45,0.15)', border: '1px solid #16a34a', borderRadius: '4px', padding: '0.2rem 0.7rem', fontSize: '0.8rem', color: '#14532d', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              + Adicionar Evento
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  <th style={{ background: '#bbf7d0', color: '#14532d', border: '1px solid #86efac', padding: '0.3rem 0.6rem', textAlign: 'left', width: '160px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>EVENTOS</th>
                  <th style={{ background: '#bbf7d0', color: '#14532d', border: '1px solid #86efac', padding: '0.3rem 0.4rem', textAlign: 'center', width: '130px', fontWeight: 700 }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem', whiteSpace: 'nowrap' }}>FREQUÊNCIA SEMANAL</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                      {FREQ_OPCOES.map(op => <span key={op} style={{ fontSize: '0.72rem', width: '14px', textAlign: 'center' }}>{op}</span>)}
                    </div>
                  </th>
                  {DIAS.map(dia => (
                    <th key={dia} style={{ background: '#bbf7d0', color: '#14532d', border: '1px solid #86efac', padding: '0.3rem 0.6rem', textAlign: 'center', minWidth: '90px', fontWeight: 700, letterSpacing: '0.04em' }}>{dia}</th>
                  ))}
                  <th style={{ background: '#bbf7d0', color: '#14532d', border: '1px solid #86efac', padding: '0.3rem 0.4rem', width: '30px' }}></th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((evento, idx) => (
                  <tr key={evento.id} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.75)' : 'rgba(220,252,231,0.5)' }}>
                    <td style={{ border: '1px solid #bbf7d0', padding: '0.15rem 0.3rem' }}>
                      <input
                        type="text"
                        className="form-input-invisible"
                        value={evento.nome}
                        onChange={e => handleNomeEvento(idx, e.target.value)}
                        onBlur={() => setEventos(prev => ordenarEventos(prev))}
                        placeholder="Nome do evento..."
                        style={{ fontWeight: 600, color: '#15803d', fontSize: '0.82rem', padding: '0.2rem' }}
                      />
                    </td>
                    <td style={{ border: '1px solid #bbf7d0', padding: '0.2rem 0.4rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        {FREQ_OPCOES.map(op => (
                          <input key={op}
                            type="checkbox"
                            checked={(evento.frequencia || []).includes(op)}
                            onChange={() => handleFrequencia(idx, op)}
                            title={op}
                            style={{ accentColor: '#16a34a', cursor: 'pointer', width: '14px', height: '14px' }}
                          />
                        ))}
                      </div>
                    </td>
                    {DIAS.map(dia => (
                      <td key={dia} style={{ border: '1px solid #bbf7d0', padding: '0.15rem 0.3rem', textAlign: 'center' }}>
                        <input
                          type="text"
                          className="form-input-invisible"
                          value={evento.horarios[dia]}
                          onChange={e => handleHorario(idx, dia, e.target.value)}
                          placeholder="--:--"
                          style={{ textAlign: 'center', fontSize: '0.82rem', color: '#374151', padding: '0.2rem', width: '100%' }}
                        />
                      </td>
                    ))}
                    <td style={{ border: '1px solid #bbf7d0', padding: '0.1rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeEvento(idx)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, lineHeight: 1, padding: '0.1rem 0.3rem' }}
                        title="Remover evento"
                      >✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.3rem' }}>
            💡 Informe os horários no formato HH:MM. Separe múltiplos horários com vírgula (ex: 08:00, 19:30)
          </p>
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
          <button type="button" onClick={onBack} className="btn-primary" style={{ backgroundColor: 'var(--text-muted)' }}>Cancelar / Voltar</button>
          <button type="button" onClick={handleSalvar} className="btn-primary">{isEdit ? 'Atualizar Comunidade' : 'Salvar Comunidade'}</button>
        </div>
      </form>
    </div>
  );
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default AppWithAuth;
