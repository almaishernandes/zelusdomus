// Entrada por impressão digital (ou Face ID) no celular, usando o leitor
// biométrico do próprio aparelho via WebAuthn (autenticador de plataforma).
//
// Não existe servidor de WebAuthn aqui — a biometria funciona como um
// "cadeado local": só libera a sessão já salva neste aparelho depois que o
// sensor confirma a digital cadastrada. Sem um login completo por senha
// antes, não há nada para liberar. Se a digital do aparelho for apagada/
// trocada, o navegador invalida o cadastro sozinho e cai de volta na senha.
import { supabase } from './supabaseClient';

const CHAVE_CRED_ID = 'zd_bio_cred_id';
const CHAVE_EMAIL = 'zd_bio_email';
const CHAVE_SESSAO = 'zd_bio_sessao';
const CHAVE_DIA_SENHA = 'zd_bio_dia_senha';
const CHAVE_OFERTA_VISTA = 'zd_bio_oferta_vista';

// Data de hoje no fuso do aparelho, como "AAAA-MM-DD".
const diaDeHoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const paraBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.byteLength; i++) binario += String.fromCharCode(bytes[i]);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const deBase64Url = (str) => {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - str.length % 4) % 4, '=');
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
};

export async function suportaBiometria() {
  try {
    if (!window.PublicKeyCredential || !navigator.credentials) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function temBiometriaAtiva() {
  try {
    return !!(localStorage.getItem(CHAVE_CRED_ID) && localStorage.getItem(CHAVE_SESSAO));
  } catch {
    return false;
  }
}

// Só vale pelo dia em que a senha foi digitada: à meia-noite (fuso do
// aparelho) a digital deixa de bastar e volta a pedir senha uma vez.
export function biometriaExpirada() {
  try {
    return localStorage.getItem(CHAVE_DIA_SENHA) !== diaDeHoje();
  } catch {
    return true;
  }
}

// Chamado depois de um login por senha bem-sucedido (com a biometria já
// ativa neste aparelho) — "destrava" a digital pelo resto do dia de hoje.
export function marcarLoginSenhaHoje() {
  try { localStorage.setItem(CHAVE_DIA_SENHA, diaDeHoje()); } catch { /* ignora */ }
}

export function emailBiometria() {
  try { return localStorage.getItem(CHAVE_EMAIL) || ''; } catch { return ''; }
}

export function jaOfereceuBiometria() {
  try { return localStorage.getItem(CHAVE_OFERTA_VISTA) === '1'; } catch { return false; }
}

export function marcarOfertaVista() {
  try { localStorage.setItem(CHAVE_OFERTA_VISTA, '1'); } catch { /* ignora */ }
}

// Mantém a sessão salva sempre atualizada (o refresh token do Supabase é de
// uso único — sem isso, a próxima tentativa de desbloqueio falharia porque o
// token guardado já teria sido trocado por um novo nos bastidores). Isso NÃO
// renova o dia liberado — só um login por senha faz isso (marcarLoginSenhaHoje).
export function sincronizarSessaoBiometrica(session) {
  if (!temBiometriaAtiva() || !session?.access_token || !session?.refresh_token) return;
  try {
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }));
  } catch { /* ignora */ }
}

// Cadastra a digital deste aparelho, vinculada à sessão já autenticada.
export async function ativarBiometria(session, email) {
  if (!session?.access_token || !session?.refresh_token) {
    return { sucesso: false, erro: 'Sessão inválida.' };
  }
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'ZelusDomus' },
        user: { id: userId, name: email || 'usuario', displayName: email || 'Usuário ZelusDomus' },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000
      }
    });
    if (!credential) return { sucesso: false, erro: 'Cadastro cancelado.' };

    localStorage.setItem(CHAVE_CRED_ID, paraBase64Url(credential.rawId));
    localStorage.setItem(CHAVE_EMAIL, email || '');
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }));
    marcarLoginSenhaHoje();
    marcarOfertaVista();
    return { sucesso: true };
  } catch (err) {
    return { sucesso: false, erro: err?.message || 'Não foi possível ativar a impressão digital neste aparelho.' };
  }
}

const CHAVE_DIA_SESSAO = 'zd_dia_sessao';
const CHAVE_DIA_SESSAO_DIA = 'zd_dia_sessao_dia';

// Para aparelhos SEM leitor de digital: evita pedir senha de novo em cada
// aba/acesso no mesmo dia. Guardada após qualquer login por senha; só vale
// até trocar o dia (ou até "Sair", que a apaga).
export function salvarSessaoDoDia(session) {
  if (!session?.access_token || !session?.refresh_token) return;
  try {
    localStorage.setItem(CHAVE_DIA_SESSAO, JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    }));
    localStorage.setItem(CHAVE_DIA_SESSAO_DIA, diaDeHoje());
  } catch { /* ignora */ }
}

export function sessaoDoDiaSalva() {
  try {
    if (localStorage.getItem(CHAVE_DIA_SESSAO_DIA) !== diaDeHoje()) return null;
    const salva = localStorage.getItem(CHAVE_DIA_SESSAO);
    return salva ? JSON.parse(salva) : null;
  } catch {
    return null;
  }
}

export function limparSessaoDoDia() {
  try {
    localStorage.removeItem(CHAVE_DIA_SESSAO);
    localStorage.removeItem(CHAVE_DIA_SESSAO_DIA);
  } catch { /* ignora */ }
}

export function desativarBiometria() {
  try {
    localStorage.removeItem(CHAVE_CRED_ID);
    localStorage.removeItem(CHAVE_EMAIL);
    localStorage.removeItem(CHAVE_SESSAO);
    localStorage.removeItem(CHAVE_DIA_SENHA);
  } catch { /* ignora */ }
}

// Pede a digital no sensor do aparelho e, se confirmada, libera a sessão
// salva (chama o Supabase para validar/renovar o refresh token).
export async function entrarComBiometria() {
  const credId = localStorage.getItem(CHAVE_CRED_ID);
  const sessaoSalva = localStorage.getItem(CHAVE_SESSAO);
  if (!credId || !sessaoSalva) return { sucesso: false, erro: 'Impressão digital não cadastrada neste aparelho.' };

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: deBase64Url(credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    if (!assertion) return { sucesso: false, erro: 'Leitura cancelada.' };

    const { access_token, refresh_token } = JSON.parse(sessaoSalva);
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
      desativarBiometria();
      return { sucesso: false, erro: 'Sessão salva expirou — entre com a senha.' };
    }
    sincronizarSessaoBiometrica(data.session);
    return { sucesso: true };
  } catch (err) {
    return { sucesso: false, erro: err?.message || 'Não foi possível confirmar a impressão digital.' };
  }
}
