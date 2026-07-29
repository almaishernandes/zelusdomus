# Como configurar o botão "Disponibilizar no Google Drive (Editável)"

O botão cria um Google Docs editável com os dados da ficha dentro de uma pasta do seu
Google Drive, com permissão de edição para quem tiver o link. Para isso, é preciso
publicar uma pequena "função" gratuita na sua conta Google (Google Apps Script) — leva
uns 10 minutos e só precisa ser feito uma vez.

## Passo 1 — Criar (ou escolher) a pasta no Google Drive

1. Acesse https://drive.google.com e crie/abra a pasta **Servidores do Altar**.
2. Com a pasta aberta, olhe a barra de endereço do navegador:
   `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQr...`
3. Copie o código depois de `folders/` — esse é o **ID da pasta**.

## Passo 2 — Publicar o script na sua conta Google

1. Acesse https://script.google.com e clique em **Novo projeto**.
2. Apague o conteúdo do editor e cole todo o código do arquivo `Code.gs` desta pasta.
3. Na linha `var PASTA_ID = 'COLE_AQUI_O_ID_DA_PASTA';` cole o ID copiado no Passo 1.
4. Dê um nome ao projeto (ex.: *ZelusDomus Drive*) e salve (Ctrl+S).
5. Clique em **Implantar → Nova implantação**.
6. Em "Selecionar tipo" (ícone de engrenagem) escolha **App da Web** e configure:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** Qualquer pessoa
7. Clique em **Implantar**, autorize o acesso quando o Google pedir
   (Avançado → Acessar o projeto), e **copie a URL do app da Web**
   (termina com `/exec`).

## Passo 3 — Configurar o app ZelusDomus

1. Abra o arquivo `.env` na raiz do projeto e preencha:

   ```
   VITE_DRIVE_WEBAPP_URL=https://script.google.com/macros/s/SEU_CODIGO_AQUI/exec
   ```

2. Gere o build novamente e publique na Hostinger:

   ```
   npm run build
   ```

   (e reenvie o conteúdo da pasta `dist` para o `public_html`)

## Como fica o uso no dia a dia

1. Abra a ficha do servidor (ícone do olho) e clique em
   **Disponibilizar no Google Drive (Editável)**.
2. Aguarde o indicador "Criando no Drive…".
3. Aparece a faixa verde com o **link do documento**: use **Copiar link** ou
   **Enviar no WhatsApp** (abre a conversa do servidor com o link e a mensagem pronta).
4. O servidor abre o link pelo WhatsApp, **preenche os campos em branco direto no
   Google Docs** (não precisa de conta Google para editar com o link) e, se quiser,
   baixa o documento pronto em Arquivo → Fazer download.

## Se algo der errado

- **"Integração não configurada"** — o `.env` está sem a URL ou o build não foi refeito
  depois de preencher.
- **Erro ao criar o documento** — confira se o `PASTA_ID` está correto no script e se a
  implantação está como "Qualquer pessoa". Após alterar o script, é preciso
  **Implantar → Gerenciar implantações → editar → Nova versão**.
