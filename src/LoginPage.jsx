import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { Mail, Lock, AlertCircle, Loader, Eye, EyeOff, Clock, Download, Share } from 'lucide-react';

// Banner de instalação do app: Android/Chrome mostra botão que instala
// automaticamente; iPhone/Safari não permite instalação por código, então
// mostra o passo a passo (Compartilhar → Adicionar à Tela de Início).
function InstalarAppBanner() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [instalado, setInstalado] = useState(false);
  const [mostrarPassosIOS, setMostrarPassosIOS] = useState(false);

  const jaEstaInstalado = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);

  const ehIOS = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    if (jaEstaInstalado) return;
    const handler = (e) => { e.preventDefault(); setPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const instalarAndroid = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalado(true);
    setPromptEvent(null);
  };

  if (jaEstaInstalado || instalado) return null;
  if (!promptEvent && !ehIOS) return null;

  return (
    <div style={{ width: '100%', maxWidth: 400, marginBottom: '1rem', background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: '0.9rem 1.1rem', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
      {promptEvent && (
        <button onClick={instalarAndroid}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#7e14ff', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
          <Download size={18} /> Instalar Aplicativo
        </button>
      )}
      {ehIOS && !promptEvent && (
        <>
          <button onClick={() => setMostrarPassosIOS(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: '#7e14ff', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 8, fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>
            <Share size={16} /> Instalar no iPhone
          </button>
          {mostrarPassosIOS && (
            <ol style={{ margin: '0.7rem 0 0', paddingLeft: '1.2rem', fontSize: '0.82rem', color: '#334155', lineHeight: 1.6 }}>
              <li>Toque no ícone <strong>Compartilhar</strong> <Share size={13} style={{ verticalAlign: 'middle' }} /> na barra do Safari</li>
              <li>Escolha <strong>"Adicionar à Tela de Início"</strong></li>
              <li>Toque em <strong>Adicionar</strong> — pronto, o app aparece na tela como os demais</li>
            </ol>
          )}
        </>
      )}
    </div>
  );
}

const CHAVE_ACESSOS_RECENTES = 'zd_acessos_recentes';
const MAX_ACESSOS_RECENTES = 4;

const lerAcessosRecentes = () => {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ACESSOS_RECENTES) || '[]');
  } catch {
    return [];
  }
};

const salvarAcessoRecente = (email) => {
  const atuais = lerAcessosRecentes().filter(e => e !== email);
  const novos = [email, ...atuais].slice(0, MAX_ACESSOS_RECENTES);
  localStorage.setItem(CHAVE_ACESSOS_RECENTES, JSON.stringify(novos));
};

export function LoginPage() {
  const { login, error, loading } = useAuth();
  const [acessosRecentes, setAcessosRecentes] = useState(() => lerAcessosRecentes());
  const [email, setEmail] = useState(() => lerAcessosRecentes()[0] || '');
  const [senha, setSenha] = useState('');
  const [mostraSenha, setMostraSenha] = useState(false);
  const [telaAtual, setTelaAtual] = useState('login'); // 'login' | 'reset'
  const [emailReset, setEmailReset] = useState('');
  const [msgReset, setMsgReset] = useState('');
  const [loadingReset, setLoadingReset] = useState(false);
  const [mostraSenhaReset, setMostraSenhaReset] = useState(false);
  const [mostraConfirmaSenhaReset, setMostraConfirmaSenhaReset] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const resultado = await login(email, senha);
    if (resultado.sucesso) {
      salvarAcessoRecente(email);
      // Sem reload: login() já deixou usuário e perfil prontos em memória
      // (AuthContext), então o React troca de tela sozinho. Um reload aqui
      // jogava fora esse trabalho e refazia toda a checagem de sessão do zero.
    }
  };

  const handleSolicitarReset = async (e) => {
    e.preventDefault();
    setLoadingReset(true);
    setMsgReset('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(emailReset, {
        redirectTo: `${window.location.origin}/#/reset-senha`
      });

      if (error) throw error;

      setMsgReset('✓ Email de recuperação enviado! Verifique sua caixa de entrada.');
      setEmailReset('');
      setTimeout(() => setTelaAtual('login'), 3000);
    } catch (err) {
      setMsgReset(err?.message || 'Erro ao solicitar recuperação.');
    } finally {
      setLoadingReset(false);
    }
  };

  if (telaAtual === 'reset') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: '2rem', background: '#fff', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem', textAlign: 'center' }}>
            Recuperar Senha
          </h1>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Digite seu email e enviaremos um link de recuperação
          </p>

          <form onSubmit={handleSolicitarReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#334155' }}>
                Email
              </label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 6, padding: '0.6rem 0.8rem', background: '#f8fafc' }}>
                <Mail size={18} color='#94a3b8' />
                <input
                  type='email'
                  value={emailReset}
                  onChange={(e) => setEmailReset(e.target.value)}
                  placeholder='seu@email.com'
                  required
                  style={{ flex: 1, border: 'none', background: 'transparent', marginLeft: '0.6rem', fontSize: '0.95rem', outline: 'none' }}
                />
              </div>
            </div>

            {msgReset && (
              <div style={{ background: msgReset.includes('✓') ? '#dcfce7' : '#fee2e2', color: msgReset.includes('✓') ? '#166534' : '#991b1b', padding: '0.8rem', borderRadius: 6, fontSize: '0.85rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                <AlertCircle size={16} style={{ flex: 'none', marginTop: '0.1rem' }} />
                <span>{msgReset}</span>
              </div>
            )}

            <button
              type='submit'
              disabled={loadingReset}
              style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.65rem', borderRadius: 6, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {loadingReset ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Enviar Link de Recuperação'}
            </button>

            <button
              type='button'
              onClick={() => setTelaAtual('login')}
              style={{ background: 'transparent', color: '#2563eb', border: '1px solid #2563eb', padding: '0.65rem', borderRadius: 6, fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Voltar ao Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '1rem' }}>
      <InstalarAppBanner />
      <div style={{ width: '100%', maxWidth: 400, padding: '2.5rem', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Zelus Domus
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Servidores do Altar
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#334155' }}>
              Email
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem 1rem', background: '#f8fafc', transition: 'all 0.2s' }}>
              <Mail size={18} color='#94a3b8' />
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='seu@email.com'
                required
                style={{ flex: 1, border: 'none', background: 'transparent', marginLeft: '0.8rem', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
            {acessosRecentes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                  <Clock size={12} /> Recentes:
                </span>
                {acessosRecentes.map(e => (
                  <button
                    key={e}
                    type='button'
                    onClick={() => setEmail(e)}
                    style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#334155', cursor: 'pointer' }}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#334155' }}>
              Senha
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem 1rem', background: '#f8fafc' }}>
              <Lock size={18} color='#94a3b8' />
              <input
                type={mostraSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder='••••••••'
                required
                style={{ flex: 1, border: 'none', background: 'transparent', marginLeft: '0.8rem', fontSize: '0.95rem', outline: 'none' }}
              />
              <button
                type='button'
                onClick={() => setMostraSenha(!mostraSenha)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                title={mostraSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostraSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.8rem 1rem', borderRadius: 8, fontSize: '0.85rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
              <AlertCircle size={16} style={{ flex: 'none', marginTop: '0.1rem' }} />
              <span>{error}</span>
            </div>
          )}

          <button
            type='submit'
            disabled={loading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Entrar'}
          </button>

          <button
            type='button'
            onClick={() => setTelaAtual('reset')}
            style={{ background: 'transparent', color: '#2563eb', border: 'none', padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
          >
            Esqueci minha senha
          </button>
        </form>

      </div>
    </div>
  );
}
