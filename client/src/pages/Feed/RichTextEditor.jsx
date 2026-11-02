import { useCallback, useEffect } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Heading2,
  Link2, Pilcrow, RemoveFormatting, Undo2, Redo2,
} from 'lucide-react';
import { richContentToEditorHtml, serializeRichDocument } from './richContent.jsx';

function ToolbarButton({ label, icon: Icon, onClick }) {
  return (
    <button
      type="button"
      className="feed-format-button"
      title={label}
      aria-label={label}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      <Icon size={15} strokeWidth={2} />
    </button>
  );
}

export default function RichTextEditor({ editorRef, onChange, onImagePaste, textLength, initialContent = '' }) {
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = richContentToEditorHtml(initialContent);
  }, [editorRef, initialContent]);

  const syncContent = useCallback(() => {
    const result = serializeRichDocument(editorRef.current);
    onChange(result.content, result.textLength);
  }, [editorRef, onChange]);

  const runCommand = useCallback((command, value = null) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    syncContent();
  }, [editorRef, syncContent]);

  function insertLink() {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const value = window.prompt('Вставь ссылку (https://...)');
    if (!value) return;

    let url;
    try {
      url = new URL(value.trim());
    } catch {
      window.alert('Укажи корректную ссылку, начинающуюся с https:// или http://');
      return;
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
      window.alert('Поддерживаются только ссылки http:// и https://');
      return;
    }
    document.execCommand('createLink', false, url.toString());
    syncContent();
  }

  function handlePaste(event) {
    const imageFiles = Array.from(event.clipboardData?.items || [])
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean);

    if (imageFiles.length) {
      event.preventDefault();
      onImagePaste(imageFiles);
      return;
    }

    // Keep pasted content predictable; formatting is applied with the editor toolbar.
    event.preventDefault();
    const plainText = event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, plainText);
    syncContent();
  }

  return (
    <div className="feed-rich-editor">
      <div className="feed-format-toolbar" role="toolbar" aria-label="Форматирование текста">
        <ToolbarButton label="Жирный" icon={Bold} onClick={() => runCommand('bold')} />
        <ToolbarButton label="Курсив" icon={Italic} onClick={() => runCommand('italic')} />
        <ToolbarButton label="Подчёркнутый" icon={Underline} onClick={() => runCommand('underline')} />
        <span className="feed-format-divider" />
        <ToolbarButton label="Заголовок" icon={Heading2} onClick={() => runCommand('formatBlock', 'h2')} />
        <ToolbarButton label="Обычный абзац" icon={Pilcrow} onClick={() => runCommand('formatBlock', 'p')} />
        <ToolbarButton label="Маркированный список" icon={List} onClick={() => runCommand('insertUnorderedList')} />
        <ToolbarButton label="Нумерованный список" icon={ListOrdered} onClick={() => runCommand('insertOrderedList')} />
        <span className="feed-format-divider" />
        <ToolbarButton label="Добавить ссылку" icon={Link2} onClick={insertLink} />
        <ToolbarButton label="Убрать форматирование" icon={RemoveFormatting} onClick={() => runCommand('removeFormat')} />
        <span className="feed-format-divider" />
        <ToolbarButton label="Отменить" icon={Undo2} onClick={() => runCommand('undo')} />
        <ToolbarButton label="Повторить" icon={Redo2} onClick={() => runCommand('redo')} />
      </div>
      <div
        ref={editorRef}
        className="feed-rich-input"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label="Текст публикации"
        aria-multiline="true"
        data-placeholder="Напиши что-нибудь... Выдели текст и выбери форматирование. Скриншот можно вставить через Ctrl+V."
        onInput={syncContent}
        onPaste={handlePaste}
      />
      <div className="feed-rich-footer">
        <span>Выдели текст, чтобы применить форматирование</span>
        <span className={textLength > 1000 ? 'over-limit' : ''}>{textLength}/1000</span>
      </div>
    </div>
  );
}
