import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Ao abrir o app numa aba/janela NOVA, descarta a sessão salva no navegador
// para forçar a tela de login (senha sempre exigida). sessionStorage sobrevive
// a um reload mas é zerado quando a aba/janela fecha. Feito ANTES de criar o
// client — assim não há sessão para restaurar e não há corrida com o signOut.
try {
  if (!sessionStorage.getItem('zd_session_started')) {
    sessionStorage.setItem('zd_session_started', '1');
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
      .forEach((k) => localStorage.removeItem(k));
  }
} catch { /* modo privado / storage bloqueado */ }

export const supabase = createClient(supabaseUrl, supabaseKey);

// Client isolado (sem persistir sessão) usado só para criar contas de login de
// servidores a partir do cadastro — evita que auth.signUp() troque a sessão
// ativa do coordenador pela do servidor recém-criado.
export const supabaseAuthOnly = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'zd-auth-only' }
});
