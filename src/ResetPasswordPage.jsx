import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Lock, AlertCircle, Loader, CheckCircle, Eye, EyeOff } from 'lucide-react';

export function ResetPasswordPage() {
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [mostraNovaSenha, setMostraNovaSenha] = useState(false);
  const [mostraConfirmaSenha, setMostraConfirmaSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [validandoToken, setValidandoToken] = useState(true);

  useEffect(() => {
    // Verificar se há sessão de recuperação
    const verificarSessao = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setErro('Link de recuperação inválido ou expirado. Solicite um novo.');
        }
      } catch (err) {
        setErro(err.message);
      } finally {
        setValidandoToken(false);
      }
    };
    verificarSessao();
  }, []);

  const handleAtualizarSenha = async (e) => {
    e.preventDefault();
    setErro('');
    setSucesso(false);

    if (!novaSenha || !confirmaSenha) {
      setErro('Preencha ambos os campos');
      return;
    }

    if (novaSenha.length < 8) {
      setErro('A senha deve ter no mínimo 8 caracteres');
      return;
    }

    if (novaSenha !== confirmaSenha) {
      setErro('As senhas não conferem');
      return;
    }

    // Validar força de senha
    const temMaiuscula = /[A-Z]/.test(novaSenha);
    const temNumero = /[0-9]/.test(novaSenha);
    if (!temMaiuscula || !temNumero) {
      setErro('A senha deve conter letras maiúsculas e números');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: novaSenha
      });

      if (error) throw error;

      setSucesso(true);
      setNovaSenha('');
      setConfirmaSenha('');

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (validandoToken) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <p>Validando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (sucesso) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <div style={{ width: '100%', maxWidth: 400, padding: '2.5rem', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
          <CheckCircle size={48} color='#16a34a' style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: '0 0 0.5rem' }}>
            Senha Atualizada!
          </h1>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>
            Sua senha foi alterada com sucesso. Redirecionando para o login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ width: '100%', maxWidth: 400, padding: '2.5rem', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            Redefinir Senha
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Digite sua nova senha
          </p>
        </div>

        {erro && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.8rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.85rem', display: 'flex', gap: '0.6rem' }}>
            <AlertCircle size={16} style={{ flex: 'none', marginTop: '0.1rem' }} />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleAtualizarSenha} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#334155' }}>
              Nova Senha
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem 1rem', background: '#f8fafc' }}>
              <Lock size={18} color='#94a3b8' />
              <input
                type={mostraNovaSenha ? 'text' : 'password'}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder='••••••••'
                style={{ flex: 1, border: 'none', background: 'transparent', marginLeft: '0.8rem', fontSize: '0.95rem', outline: 'none' }}
              />
              <button
                type='button'
                onClick={() => setMostraNovaSenha(!mostraNovaSenha)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                title={mostraNovaSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostraNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.3rem 0 0' }}>
              Mínimo 8 caracteres, com letras maiúsculas e números
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem', color: '#334155' }}>
              Confirmar Senha
            </label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.7rem 1rem', background: '#f8fafc' }}>
              <Lock size={18} color='#94a3b8' />
              <input
                type={mostraConfirmaSenha ? 'text' : 'password'}
                value={confirmaSenha}
                onChange={(e) => setConfirmaSenha(e.target.value)}
                placeholder='••••••••'
                style={{ flex: 1, border: 'none', background: 'transparent', marginLeft: '0.8rem', fontSize: '0.95rem', outline: 'none' }}
              />
              <button
                type='button'
                onClick={() => setMostraConfirmaSenha(!mostraConfirmaSenha)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                title={mostraConfirmaSenha ? 'Esconder senha' : 'Mostrar senha'}
              >
                {mostraConfirmaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type='submit'
            disabled={loading}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Atualizar Senha'}
          </button>
        </form>
      </div>
    </div>
  );
}
