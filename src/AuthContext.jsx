import React, { createContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null); // 'servidor' | 'coordenador'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const perfilRef = useRef(null);
  const userIdRef = useRef(null);

  useEffect(() => { perfilRef.current = perfil; }, [perfil]);

  // Verificar sessão ao montar (apenas um listener, sem race condition)
  useEffect(() => {
    let mounted = true;
    let sessionChecked = false;

    // Ao abrir o app pela primeira vez nesta aba/janela, força a tela de login
    // mesmo que exista uma sessão salva no navegador. sessionStorage é limpo
    // quando a aba/janela fecha, mas sobrevive a um reload (usado após o login).
    const jaIniciouNestaAba = sessionStorage.getItem('zd_session_started');
    if (!jaIniciouNestaAba) {
      sessionStorage.setItem('zd_session_started', '1');
      supabase.auth.signOut();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('[AUTH] Estado mudou:', event, session?.user?.email);

      if (session?.user) {
        setUser(session.user);

        // Eventos como TOKEN_REFRESHED (renovação silenciosa do token, disparada
        // periodicamente pelo Supabase) não devem re-disparar a busca de perfil
        // enquanto o mesmo usuário já está com o perfil carregado — evita que
        // um timeout de rede troque o coordenador por servidor (ou vice-versa)
        // no meio do uso. O perfil só é recarregado num login novo (troca de
        // usuário) ou se ainda não havia sido carregado.
        if (event !== 'SIGNED_IN' && perfilRef.current && userIdRef.current === session.user.id) {
          console.log('[AUTH] Mantendo perfil já carregado:', perfilRef.current.tipo);
          return;
        }

        userIdRef.current = session.user.id;
        console.log('[AUTH] Iniciando carregamento de perfil...');
        try {
          await carregarPerfil(session.user.id);
          console.log('[AUTH] Perfil carregado com sucesso');
        } catch (err) {
          console.error('[AUTH] Erro ao carregar perfil:', err);
          setLoading(false);
        }
      } else {
        userIdRef.current = null;
        setUser(null);
        setPerfil(null);
        setLoading(false);
      }

      // Marcar que verificou a sessão inicial
      if (!sessionChecked) {
        sessionChecked = true;
        console.log('[AUTH] Marcando como carregado');
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Executa uma query com timeout; se estourar o tempo, tenta mais uma vez antes de desistir
  // (conexões lentas ou o banco "acordando" no plano Free podem estourar um timeout curto único).
  const comTimeoutERetry = async (fazerQuery, tentativas = 2, timeoutMs = 10000) => {
    let ultimoErro;
    for (let i = 0; i < tentativas; i++) {
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Query timeout ${timeoutMs}ms`)), timeoutMs)
        );
        return await Promise.race([fazerQuery(), timeoutPromise]);
      } catch (err) {
        ultimoErro = err;
        console.warn(`[AUTH] Tentativa ${i + 1} falhou:`, err.message);
      }
    }
    throw ultimoErro;
  };

  const carregarPerfil = async (userId) => {
    console.log('[AUTH] Carregando perfil para:', userId);

    try {
      // Busca coordenador e servidor em paralelo (não em sequência) — corta pela
      // metade o tempo de espera em conexões lentas, já que antes o app só
      // consultava servidor_profiles depois de esperar coordenador_profiles falhar.
      console.log('[AUTH] Buscando coordenador e servidor em paralelo...');
      const [coordResult, servResult] = await Promise.all([
        comTimeoutERetry(() => supabase.from('coordenador_profiles').select('*').eq('id', userId)),
        comTimeoutERetry(() => supabase.from('servidor_profiles').select('*').eq('id', userId))
      ]);

      const coord = coordResult.data?.[0];
      if (coord && !coordResult.error) {
        console.log('[AUTH] ✓ Coordenador encontrado!');
        setPerfil({ tipo: 'coordenador', ...coord });
        setLoading(false);
        return;
      }

      const serv = servResult.data?.[0];
      if (serv && !servResult.error) {
        console.log('[AUTH] ✓ Servidor encontrado!');
        let funcoes = [];
        try {
          const { data: servers } = await supabase
            .from('servers')
            .select('type')
            .eq('cadastro', serv.numero_cadastro);
          funcoes = [...new Set((servers || []).map(s => s.type))];
        } catch (e) {
          console.error('[AUTH] Erro ao buscar função do servidor:', e);
        }
        setPerfil({ tipo: 'servidor', ...serv, funcoes });
        setLoading(false);
        return;
      }

      console.log('[AUTH] Nenhum perfil encontrado!');
      setPerfil(null);
      setLoading(false);
    } catch (err) {
      console.error('[AUTH] ERRO CAPTURADO (após tentativas):', err.message);
      // Mantém o perfil anterior em vez de derrubar o coordenador para nulo
      // por causa de uma falha de rede transitória.
      setLoading(false);
    }
  };

  // Login com email + senha (funciona para servidor e coordenador)
  const login = async (email, senha) => {
    setError(null);
    console.log('[AUTH] Iniciando login com:', email);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: senha
      });

      console.log('[AUTH] Resposta login:', { data, authError });

      if (authError) throw authError;

      console.log('[AUTH] User:', data.user.id);
      setUser(data.user);
      console.log('[AUTH] Carregando perfil...');
      await carregarPerfil(data.user.id);
      console.log('[AUTH] Login sucesso!');
      return { sucesso: true };
    } catch (err) {
      console.error('[AUTH] Erro:', err);
      const mensagem = err.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos'
        : err.message;
      setError(mensagem);
      return { sucesso: false, erro: mensagem };
    }
  };

  // Logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPerfil(null);
  };

  // Solicitar reset de senha
  const solicitarReset = async (email) => {
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-senha`
      });

      if (resetError) throw resetError;
      return { sucesso: true };
    } catch (err) {
      setError(err.message);
      return { sucesso: false, erro: err.message };
    }
  };

  // Atualizar senha com token
  const atualizarSenha = async (novaSenha) => {
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (updateError) throw updateError;
      return { sucesso: true };
    } catch (err) {
      setError(err.message);
      return { sucesso: false, erro: err.message };
    }
  };

  const value = {
    user,
    perfil,
    loading,
    error,
    login,
    logout,
    solicitarReset,
    atualizarSenha,
    eAutenticado: !!user,
    ehCoordenador: perfil?.tipo === 'coordenador',
    ehServidor: perfil?.tipo === 'servidor'
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
