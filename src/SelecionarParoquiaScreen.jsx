import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { Church, LogOut, Loader } from 'lucide-react';

// Tela exibida só para o acesso de suporte, entre o login e o app: escolhe
// em qual paróquia ele vai trabalhar nesta sessão. Coordenador/servidor comum
// nunca vê esta tela — a paróquia deles já vem fixa no próprio cadastro.
export function SelecionarParoquiaScreen() {
  const { escolherParoquia, logout } = useAuth();
  const [paroquias, setParoquias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [escolhendoId, setEscolhendoId] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('paroquias').select('*').eq('ativa', true).order('nome');
      if (error) setErro(error.message);
      setParoquias(data || []);
      setCarregando(false);
    })();
  }, []);

  const handleEscolher = async (id) => {
    setEscolhendoId(id);
    const resultado = await escolherParoquia(id);
    if (!resultado.sucesso) {
      setErro(resultado.erro);
      setEscolhendoId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '2.5rem', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.8rem' }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>Acesso de Suporte</h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>Selecione a paróquia para acessar</p>
        </div>

        {carregando ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1.5rem' }}>
            <Loader size={24} style={{ animation: 'spin 1s linear infinite', color: '#7e14ff' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {paroquias.map(p => (
              <button
                key={p.id}
                type="button"
                disabled={!!escolhendoId}
                onClick={() => handleEscolher(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 10, padding: '0.9rem 1rem', background: '#f8fafc', cursor: escolhendoId ? 'default' : 'pointer', opacity: escolhendoId && escolhendoId !== p.id ? 0.5 : 1 }}
              >
                <Church size={20} color="#7e14ff" />
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{p.nome}</div>
                  {p.cidade && <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{p.cidade}</div>}
                </span>
                {escolhendoId === p.id && <Loader size={16} style={{ animation: 'spin 1s linear infinite', color: '#7e14ff' }} />}
              </button>
            ))}
            {!paroquias.length && (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma paróquia cadastrada.</p>
            )}
          </div>
        )}

        {erro && (
          <p style={{ marginTop: '1rem', color: '#991b1b', fontSize: '0.82rem', textAlign: 'center' }}>{erro}</p>
        )}

        <button
          type="button"
          onClick={logout}
          style={{ marginTop: '1.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'transparent', color: '#64748b', border: 'none', padding: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <LogOut size={15} /> Sair
        </button>
      </div>
    </div>
  );
}
