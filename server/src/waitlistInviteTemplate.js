const DEFAULT_SUBJECT = 'Приглашение попробовать HEY Messenger';

const DEFAULT_BODY =
`Привет!

Ты оставлял(а) заявку, чтобы попробовать HEY Messenger. Открытая регистрация на сайте пока недоступна — вход только по персональному приглашению. Поэтому мы отвечаем на твою заявку этим письмом.

{{inviterName}} приглашает тебя в HEY — мессенджер для приватного круга без рекламы.

Перейди по ссылке и зарегистрируйся:
{{inviteLink}}

Ссылка персональная и действует ограниченное число раз. Если письмо пришло по ошибке — просто проигнорируй его.`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyTemplateVars(template, { inviterName, inviteLink }) {
  return String(template)
    .replace(/\{\{inviterName\}\}/g, inviterName)
    .replace(/\{\{inviteLink\}\}/g, inviteLink);
}

function bodyTextToHtml(text, inviteLink) {
  const link = escapeHtml(inviteLink);
  const btnStyle =
    'background:#5F4080;color:#F9F0F0;padding:12px 22px;border-radius:10px;' +
    'text-decoration:none;display:inline-block;font-weight:600';

  return text.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';

    if (trimmed === inviteLink) {
      return (
        `<p><a href="${link}" style="${btnStyle}">Принять приглашение</a></p>` +
        `<p style="color:#888;font-size:12px">Если кнопка не работает — открой в браузере:<br>` +
        `<a href="${link}">${link}</a></p>`
      );
    }

    if (trimmed.includes(inviteLink)) {
      const before = trimmed.slice(0, trimmed.indexOf(inviteLink)).trim();
      const after = trimmed.slice(trimmed.indexOf(inviteLink) + inviteLink.length).trim();
      let out = '';
      if (before) out += `<p>${escapeHtml(before).replace(/\n/g, '<br>')}</p>`;
      out += `<p><a href="${link}" style="${btnStyle}">Принять приглашение</a></p>`;
      out += `<p style="color:#888;font-size:12px">Если кнопка не работает — открой в браузере:<br>` +
        `<a href="${link}">${link}</a></p>`;
      if (after) out += `<p>${escapeHtml(after).replace(/\n/g, '<br>')}</p>`;
      return out;
    }

    return `<p>${escapeHtml(trimmed).replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('');
}

function getWaitlistInviteTemplate(db) {
  return {
    subject: db.getSetting('waitlist_invite_subject', DEFAULT_SUBJECT),
    body: db.getSetting('waitlist_invite_body', DEFAULT_BODY),
  };
}

function saveWaitlistInviteTemplate(db, { subject, body }) {
  if (subject !== undefined) {
    const s = String(subject).trim();
    if (!s) throw new Error('Тема письма не может быть пустой');
    if (s.length > 200) throw new Error('Тема слишком длинная');
    db.setSetting('waitlist_invite_subject', s);
  }
  if (body !== undefined) {
    const b = String(body);
    if (!b.trim()) throw new Error('Текст письма не может быть пустым');
    if (b.length > 10000) throw new Error('Текст слишком длинный');
    if (!b.includes('{{inviteLink}}')) {
      throw new Error('В тексте должна быть переменная {{inviteLink}}');
    }
    db.setSetting('waitlist_invite_body', b);
  }
}

function resetWaitlistInviteTemplate(db) {
  db.setSetting('waitlist_invite_subject', DEFAULT_SUBJECT);
  db.setSetting('waitlist_invite_body', DEFAULT_BODY);
  return getWaitlistInviteTemplate(db);
}

function renderWaitlistInviteEmail(db, { inviterName, inviteLink }) {
  const tpl = getWaitlistInviteTemplate(db);
  const vars = { inviterName, inviteLink };
  const subject = applyTemplateVars(tpl.subject, vars);
  const text = applyTemplateVars(tpl.body, vars);
  const html = bodyTextToHtml(text, inviteLink);
  return { subject, text, html };
}

module.exports = {
  DEFAULT_SUBJECT,
  DEFAULT_BODY,
  getWaitlistInviteTemplate,
  saveWaitlistInviteTemplate,
  resetWaitlistInviteTemplate,
  renderWaitlistInviteEmail,
};
