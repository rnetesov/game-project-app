import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Save, X, ClipboardPaste, LoaderCircle } from 'lucide-react';
import RichTextEditor from './RichTextEditor.jsx';
import { updatePost, getAssetUrl } from '../../services/api.js';

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export default function EditPostForm({ post, onCancel, onSaved }) {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const localFilesRef = useRef([]);
  const [content, setContent] = useState(post.content || '');
  const [textLength, setTextLength] = useState(0);
  const [keptImages, setKeptImages] = useState(post.images || []);
  const [newImages, setNewImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const syncNewImages = next => {
    localFilesRef.current = next;
    setNewImages(next);
  };

  useEffect(() => () => {
    localFilesRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const addImages = files => {
    const accepted = [];
    let slots = Math.max(0, MAX_IMAGES - keptImages.length - newImages.length);
    for (const file of Array.from(files || [])) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError('Поддерживаются только JPG, PNG, WEBP и GIF');
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setError('Размер одного изображения не должен превышать 8 МБ');
        continue;
      }
      if (slots <= 0) {
        setError('Можно прикрепить не более 4 изображений');
        break;
      }
      accepted.push({
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        file,
        previewUrl: URL.createObjectURL(file),
      });
      slots -= 1;
    }
    if (accepted.length) {
      syncNewImages([...localFilesRef.current, ...accepted]);
      setError('');
    }
  };

  const handleEditorChange = useCallback((nextContent, nextLength) => {
    setContent(nextContent);
    setTextLength(nextLength);
  }, []);

  const removeNewImage = id => {
    const removed = localFilesRef.current.find(item => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    syncNewImages(localFilesRef.current.filter(item => item.id !== id));
  };

  async function handleSave(event) {
    event.preventDefault();
    if (saving || textLength > 1000) return;
    if (!content.trim() && keptImages.length + newImages.length === 0) {
      setError('Добавь текст или прикрепи изображение');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const result = await updatePost(
        post.id,
        content,
        newImages.map(item => item.file),
        keptImages.map(image => image.id),
      );
      onSaved(result.post);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить изменения');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="feed-edit-form" onSubmit={handleSave}>
      <div className="feed-edit-heading">
        <strong>Редактирование публикации</strong>
        <span>Измени текст и изображения, затем сохрани результат</span>
      </div>
      <RichTextEditor
        editorRef={editorRef}
        initialContent={post.content || ''}
        onChange={handleEditorChange}
        onImagePaste={addImages}
        textLength={textLength}
      />
      {(keptImages.length > 0 || newImages.length > 0) && (
        <div className="feed-attachment-area">
          <div className="feed-attachment-heading">
            <span>Изображения публикации</span>
            <small>{keptImages.length + newImages.length} из {MAX_IMAGES}</small>
          </div>
          <div className="feed-attachment-grid">
            {keptImages.map((image, index) => (
              <div className="feed-attachment-preview" key={image.id}>
                <img src={getAssetUrl(image.url)} alt={'Изображение ' + (index + 1)} />
                <span>Сохранённое изображение</span>
                <button type="button" onClick={() => setKeptImages(current => current.filter(item => item.id !== image.id))} aria-label="Удалить изображение"><X size={14} /></button>
              </div>
            ))}
            {newImages.map((item, index) => (
              <div className="feed-attachment-preview" key={item.id}>
                <img src={item.previewUrl} alt={'Новое изображение ' + (index + 1)} />
                <span>{item.file.name || 'Новое изображение'}</span>
                <button type="button" onClick={() => removeNewImage(item.id)} aria-label="Убрать изображение"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <div className="feed-error">{error}</div>}
      <div className="feed-edit-footer">
        <div className="feed-editor-tools">
          <input
            ref={fileInputRef}
            className="feed-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={event => { addImages(event.target.files); event.target.value = ''; }}
          />
          <button type="button" className="feed-attach-button" onClick={() => fileInputRef.current?.click()} disabled={keptImages.length + newImages.length >= MAX_IMAGES}>
            <ImagePlus size={15} /> Добавить изображения
          </button>
          <span className="feed-editor-hint"><ClipboardPaste size={13} /> Ctrl+V для скриншота</span>
        </div>
        <div className="feed-edit-actions">
          <button type="button" className="feed-edit-cancel" onClick={onCancel} disabled={saving}>Отмена</button>
          <button type="submit" className="primary-button" disabled={saving || textLength > 1000}>
            {saving ? <LoaderCircle size={15} className="feed-spin" /> : <Save size={15} />}
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
      <div className="feed-upload-limits">JPG, PNG, WEBP или GIF · до 4 изображений · максимум 8 МБ каждое</div>
    </form>
  );
}
