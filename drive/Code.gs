// ═══════════════════════════════════════════════════════════════════════════
// ZelusDomus — Ficha de Cadastro editável no Google Drive
// ═══════════════════════════════════════════════════════════════════════════
// Este script recebe os dados da ficha enviados pelo app e cria um Google Docs
// editável dentro da pasta compartilhada dos Servidores do Altar, com permissão
// de edição para qualquer pessoa com o link.
//
// COMO PUBLICAR (veja o passo a passo completo em COMO-CONFIGURAR.md):
//   1. Cole o ID da pasta do Drive na constante PASTA_ID abaixo.
//   2. Implantar > Nova implantação > App da Web
//        - Executar como: Eu
//        - Quem pode acessar: Qualquer pessoa
//   3. Copie a URL do app da web para o .env do ZelusDomus (VITE_DRIVE_WEBAPP_URL).

var PASTA_ID = '14pOV0kRhAe9pGHFHNUlaygx0CkfWNtXX';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);

    var titulo = 'Ficha de Cadastro' +
      (d.cadastro ? ' - Nº ' + d.cadastro : '') +
      (d.nome ? ' - ' + d.nome : '');

    var doc = DocumentApp.create(titulo);
    var body = doc.getBody();

    body.appendParagraph('ZelusDomus — Ficha de Cadastro')
      .setHeading(DocumentApp.ParagraphHeading.HEADING1);
    body.appendParagraph('Servidores do Altar')
      .setHeading(DocumentApp.ParagraphHeading.HEADING3);
    body.appendParagraph('Preencha os campos em branco e devolva a ficha para atualizarmos o cadastro.')
      .setItalic(true);

    // ── Dados pessoais ──
    body.appendTable([
      ['Cadastro Nº', String(d.cadastro || '')],
      ['Nome', String(d.nome || '')],
      ['Nascimento', String(d.nascimento || '')],
      ['WhatsApp', String(d.whatsapp || '')],
      ['Residência', String(d.residencia || '')]
    ]);

    // ── Responsáveis ──
    body.appendParagraph('Responsáveis').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var r = d.responsaveis || {};
    body.appendTable([
      ['Mãe', String((r.mae || {}).nome || ''), 'WhatsApp', String((r.mae || {}).whatsapp || '')],
      ['Pai', String((r.pai || {}).nome || ''), 'WhatsApp', String((r.pai || {}).whatsapp || '')],
      ['Outro', String((r.outro || {}).nome || ''), 'WhatsApp', String((r.outro || {}).whatsapp || '')]
    ]);

    // ── Função que exerce ──
    body.appendParagraph('Função que exerce').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var funcRow = [];
    for (var nomeFunc in (d.funcoes || {})) {
      funcRow.push((d.funcoes[nomeFunc] ? '☑ ' : '☐ ') + nomeFunc);
    }
    if (funcRow.length) body.appendTable([funcRow]);

    // ── Sacramentos ──
    body.appendParagraph('Sacramentos').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var sacRows = [['Sacramento', 'Recebeu?', 'Data']];
    (d.sacramentos || []).forEach(function (s) {
      sacRows.push([String(s.nome || ''), s.recebido ? '☑' : '☐', String(s.data || '')]);
    });
    body.appendTable(sacRows);

    // ── Investiduras ──
    body.appendParagraph('Investidura').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    var invRows = [['Investidura', 'Recebeu?', 'Data']];
    (d.investiduras || []).forEach(function (iv) {
      invRows.push([String(iv.nome || ''), iv.recebido ? '☑' : '☐', String(iv.data || '')]);
    });
    body.appendTable(invRows);

    // ── Comunidades e horários de missa ──
    body.appendParagraph('Comunidade que Atua — dias e horários de missa')
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    if (!d.comunidades || d.comunidades.length === 0) {
      body.appendParagraph('Nenhuma comunidade selecionada no cadastro.');
    } else {
      d.comunidades.forEach(function (c) {
        body.appendParagraph('☑ ' + c.nome).setHeading(DocumentApp.ParagraphHeading.HEADING3);
        if (!c.horarios || c.horarios.length === 0) {
          body.appendParagraph('Sem horários de missa cadastrados para esta comunidade.');
        } else {
          var rows = [['Evento', 'Participação', 'Horário']];
          c.horarios.forEach(function (h) {
            rows.push([String(h.evento || ''), String(h.participacao || ''), String(h.horario || '')]);
          });
          body.appendTable(rows);
        }
      });
    }

    // ── Anotações ──
    body.appendParagraph('Anotações (restrições alimentares, medicações de uso contínuo, prescrição médica, e outros)')
      .setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(String(d.anotacoes || ' '));

    doc.saveAndClose();

    // Move para a pasta compartilhada e libera edição para quem tiver o link
    var file = DriveApp.getFileById(doc.getId());
    file.moveTo(DriveApp.getFolderById(PASTA_ID));
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

    return ContentService
      .createTextOutput(JSON.stringify({ url: doc.getUrl() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
