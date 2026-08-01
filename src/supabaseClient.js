import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Client isolado (sem persistir sessão) usado só para criar contas de login de
// servidores a partir do cadastro — evita que auth.signUp() troque a sessão
// ativa do coordenador pela do servidor recém-criado.
export const supabaseAuthOnly = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, storageKey: 'zd-auth-only' }
});
