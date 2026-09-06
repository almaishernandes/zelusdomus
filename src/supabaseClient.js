import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Sessão POR ABA: guardada em sessionStorage em vez de localStorage.
//  - cada aba/janela tem o próprio login → senha é exigida ao abrir;
//  - sobrevive a um reload (sessionStorage não é limpo no F5);
//  - some ao fechar a aba;
//  - abas diferentes não compartilham nem disputam a mesma sessão.
const authStorage = (() => {
  try { return window.sessionStorage; } catch { return undefined; }
})();

// lock "no-op": o lock padrão (navigator.locks, por projeto) gera o erro
// "Lock ... was released because another request stole it" quando há mais de
// uma aba/instância do app. Como cada aba agora tem sessão isolada, o lock
// entre abas não é necessário.
const noopLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: authStorage, lock: noopLock },
});

// Client isolado (sem persistir sessão) usado só para criar contas de login de
// servidores a partir do cadastro — evita que auth.signUp() troque a sessão
// ativa do coordenador pela do servidor recém-criado.
export const supabaseAuthOnly = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'zd-auth-only', lock: noopLock },
});
