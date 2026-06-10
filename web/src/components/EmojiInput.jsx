// EmojiInput.jsx — chat composer input that renders [name] tokens as
// inline <img> emoji while preserving plain-text editing.
//
// Why contenteditable instead of <textarea>?
//   В textarea нельзя вставить <img>, поэтому пользователь, набирая
//   «[smiling]», видел сырой код. Это бесило. Compromise — отдельная
//   плашка-превью под полем — пользователь отверг, попросил «сразу в чате».
//
// API совместим с <textarea>:
//   • ref → underlying div (поддерживает .focus(), .scrollHeight, .style)
//   • value (string) с токенами «[name]» — авто-замена на <img> при вводе
//   • onChange({ target: { value } }) — стандартный сигнал родителю
//   • onKeyDown — проброс
//   • placeholder через data-attr + CSS :empty::before
//
// Caret-сохранение: считаем сериализованный offset до перерисовки,
// после перерисовки восстанавливаем (длина не меняется, т.к. <img> ↔ [name]).

import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { HEY_EMOJI_SET, emojiUrl } from '../lib/heyEmoji';

const TOKEN_RE = /\[([a-z][a-z 0-9_-]*)\]/gi;

function escapeHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tokensToHTML(text) {
  return escapeHTML(text)
    .replace(TOKEN_RE, (m, rawName) => {
      const name = rawName.toLowerCase();
      if (HEY_EMOJI_SET.has(name)) {
        return `<img src="${emojiUrl(name)}" alt="[${name}]" data-emoji="${name}" `
             + `draggable="false" contenteditable="false" `
             + `style="width:20px;height:20px;vertical-align:-4px;display:inline-block;`
             + `margin:0 1px;user-select:none;" />`;
      }
      return escapeHTML(m);
    })
    .replace(/\n/g, '<br>');
}

// Inline-узлы внутри строки (без block-обёрток)
function serializeInline(el) {
  let s = '';
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) s += node.textContent;
    else if (node.nodeName === 'IMG' && node.dataset.emoji) s += '[' + node.dataset.emoji + ']';
    else if (node.nodeName === 'BR') s += '\n';
    else if (node.nodeType === Node.ELEMENT_NODE) s += serializeInline(node);
  }
  return s;
}

// DOM → text (img → [name], <br>/<div> → \n). Chrome при Enter создаёт <div>,
// без обработки block-элементов многострочный текст схлопывался в одну строку.
function serialize(el) {
  let s = '';
  for (let i = 0; i < el.childNodes.length; i++) {
    const node = el.childNodes[i];
    if (node.nodeType === Node.TEXT_NODE) {
      s += node.textContent;
    } else if (node.nodeName === 'IMG' && node.dataset.emoji) {
      s += '[' + node.dataset.emoji + ']';
    } else if (node.nodeName === 'BR') {
      s += '\n';
    } else if (node.nodeName === 'DIV' || node.nodeName === 'P') {
      if (s.length > 0 && !s.endsWith('\n')) s += '\n';
      s += serializeInline(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      s += serializeInline(node);
    }
  }
  return s;
}

// Серилизованная позиция каретки относительно root
function getCaretOffset(root) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return 0;

  let offset = 0;
  let done = false;
  function walk(node) {
    if (done) return;
    if (node === range.endContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        offset += range.endOffset;
      } else {
        let i = 0;
        for (const child of node.childNodes) {
          if (i >= range.endOffset) break;
          walk(child);
          i++;
        }
      }
      done = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent.length;
    } else if (node.nodeName === 'IMG' && node.dataset.emoji) {
      offset += node.dataset.emoji.length + 2;
    } else if (node.nodeName === 'BR') {
      offset += 1;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of node.childNodes) walk(child);
    }
  }
  walk(root);
  return offset;
}

// Вернуть каретку на заданный сериализованный offset
function setCaretOffset(root, target) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  let offset = 0;
  let placed = false;
  function walk(node) {
    if (placed) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (offset + len >= target) {
        range.setStart(node, Math.max(0, target - offset));
        range.collapse(true);
        placed = true;
        return;
      }
      offset += len;
    } else if (node.nodeName === 'IMG' && node.dataset.emoji) {
      const len = node.dataset.emoji.length + 2;
      if (offset + len > target) {
        const parent = node.parentNode;
        const idx = Array.prototype.indexOf.call(parent.childNodes, node);
        range.setStart(parent, idx + 1); // после img
        range.collapse(true);
        placed = true;
        return;
      }
      offset += len;
    } else if (node.nodeName === 'BR') {
      if (offset + 1 > target) {
        const parent = node.parentNode;
        const idx = Array.prototype.indexOf.call(parent.childNodes, node);
        range.setStart(parent, idx);
        range.collapse(true);
        placed = true;
        return;
      }
      offset += 1;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      for (const child of node.childNodes) walk(child);
    }
  }
  walk(root);
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

const EmojiInput = forwardRef(function EmojiInput(
  { value, onChange, onKeyDown, placeholder, style, className, ...rest }, ref
) {
  const divRef = useRef(null);
  useImperativeHandle(ref, () => divRef.current, []);

  // Sync from external value → DOM (только если расходится с текущим).
  // useLayoutEffect — чтобы перерисовка случилась до коммита фрейма и
  // не было «промигивания» сырых токенов.
  useLayoutEffect(() => {
    const el = divRef.current;
    if (!el) return;
    if (serialize(el) === value) return;
    el.innerHTML = tokensToHTML(value || '');
    // Курсор — в конец (внешние обновления обычно после send/insertEmoji)
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [value]);

  function handleInput() {
    const el = divRef.current;
    if (!el) return;
    const text = serialize(el);

    // Авто-замена готовых [name] токенов на <img>. Триггер — наличие
    // хоть одного валидного токена в тексте. Сериализованная длина не
    // меняется (img → [name] в обратной стороне), поэтому caretOffset
    // переносится 1:1.
    let needRewrite = false;
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(text))) {
      if (HEY_EMOJI_SET.has(m[1].toLowerCase())) { needRewrite = true; break; }
    }

    if (needRewrite) {
      const caret = getCaretOffset(el);
      el.innerHTML = tokensToHTML(text);
      setCaretOffset(el, caret);
    }

    onChange?.({ target: { value: text } });
  }

  // Вставка plain-text — обычный execCommand, чтобы потом сработала
  // handleInput с авто-заменой токенов.
  function handlePaste(e) {
    e.preventDefault();
    const t = e.clipboardData?.getData('text/plain') || '';
    if (t) document.execCommand('insertText', false, t);
  }

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      spellCheck
      data-placeholder={placeholder || ''}
      onInput={handleInput}
      onKeyDown={(e) => {
        // Enter → новая строка (<br>), Ctrl/Cmd+Enter — родитель (отправка).
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          if (document.queryCommandSupported?.('insertLineBreak')) {
            document.execCommand('insertLineBreak');
          } else {
            document.execCommand('insertHTML', false, '<br>');
          }
        }
        onKeyDown?.(e);
      }}
      onPaste={handlePaste}
      className={(className || '') + ' hey-emoji-input'}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        outline: 'none',
        ...style,
      }}
      {...rest}
    />
  );
});

export default EmojiInput;
