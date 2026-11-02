import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  MessageSquare, Send, Trash2, Newspaper, RefreshCw, Pencil,
  ImagePlus, X, ClipboardPaste,
} from 'lucide-react';
import {
  createPost, deletePost, getPosts, getPost, togglePostReaction, getPostReactions,
  getPostComments, createPostComment, deletePostComment, getAssetUrl,
} from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import EditPostForm from './EditPostForm.jsx';
import { renderPostContent } from './richContent.jsx';
import './ActivityFeed.css';

const MAX_POST_IMAGES = 4;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date);
}
function Avatar({ author }) {
  if (author.avatarUrl) return <img className="feed-avatar" src={author.avatarUrl} alt="" />;
  return <div className="feed-avatar feed-avatar-fallback">{author.username?.[0]?.toUpperCase() || '?'}</div>;
}

export default function ActivityFeed() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetPostId = searchParams.get('post');
  const requestedPostIdRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [content, setContent] = useState('');
  const [contentTextLength, setContentTextLength] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const [editingPostId, setEditingPostId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentBusy, setCommentBusy] = useState({});
  const [reactionDetails, setReactionDetails] = useState({});
  const fileInputRef = useRef(null);
  const editorRef = useRef(null);
  const attachmentRef = useRef([]);

  const syncAttachments = (next) => {
    attachmentRef.current = next;
    setAttachments(next);
  };

  const addImages = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const accepted = [];
    const rejected = [];
    let remaining = Math.max(0, MAX_POST_IMAGES - attachmentRef.current.length);

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        rejected.push('Формат ' + (file.name || 'файла') + ' не поддерживается');
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        rejected.push((file.name || 'Изображение') + ': максимум 8 МБ на файл');
        continue;
      }
      if (remaining <= 0) {
        rejected.push('Можно прикрепить не более 4 изображений');
        continue;
      }
      accepted.push({
        id: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2),
        file,
        previewUrl: URL.createObjectURL(file),
      });
      remaining -= 1;
    }

    if (accepted.length) syncAttachments([...attachmentRef.current, ...accepted]);
    if (rejected.length) setError(rejected[0]);
    else setError('');
  };

  const removeAttachment = (id) => {
    const current = attachmentRef.current;
    const removed = current.find(item => item.id === id);
    if (removed) URL.revokeObjectURL(removed.previewUrl);
    syncAttachments(current.filter(item => item.id !== id));
  };

  const clearAttachments = () => {
    attachmentRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl));
    syncAttachments([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  useEffect(() => () => {
    attachmentRef.current.forEach(item => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    if (!lightboxImage) return undefined;
    const handleKeyDown = event => {
      if (event.key === 'Escape') setLightboxImage('');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  const load = useCallback(async (nextCursor = null) => {
    if (nextCursor) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const data = await getPosts({ cursor: nextCursor, limit: 10 });
      setPosts(current => nextCursor ? [...current, ...data.posts] : data.posts);
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить ленту');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!targetPostId) {
      requestedPostIdRef.current = null;
      return;
    }
    if (loading) return;

    const existingPost = posts.find(post => post.id === targetPostId);
    if (existingPost) {
      const element = document.getElementById('feed-post-' + targetPostId);
      if (!element) return;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('is-notification-target');
      window.setTimeout(() => element.classList.remove('is-notification-target'), 2600);
      requestedPostIdRef.current = null;
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('post');
        return next;
      }, { replace: true });
      return;
    }

    if (requestedPostIdRef.current === targetPostId) return;
    requestedPostIdRef.current = targetPostId;
    getPost(targetPostId)
      .then(data => {
        setPosts(current => current.some(post => post.id === data.post.id)
          ? current
          : [data.post, ...current]);
      })
      .catch(err => {
        setError(err.message || 'Не удалось открыть публикацию из уведомления');
        requestedPostIdRef.current = null;
        setSearchParams(current => {
          const next = new URLSearchParams(current);
          next.delete('post');
          return next;
        }, { replace: true });
      });
  }, [targetPostId, posts, loading, setSearchParams]);

  function handleEditorChange(nextContent, nextTextLength) {
    setContent(nextContent);
    setContentTextLength(nextTextLength);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    addImages(event.dataTransfer?.files);
  }

  async function submitPost(event) {
    event.preventDefault();
    if ((!content.trim() && !attachments.length) || contentTextLength > 1000 || posting) return;
    setPosting(true);
    setError('');
    try {
      const data = await createPost(content, attachments.map(item => item.file));
      setPosts(current => [data.post, ...current]);
      setContent('');
      setContentTextLength(0);
      if (editorRef.current) editorRef.current.innerHTML = '';
      clearAttachments();
    } catch (err) {
      setError(err.message || 'Не удалось опубликовать запись');
    } finally {
      setPosting(false);
    }
  }

  async function removePost(id) {
    if (!window.confirm('Удалить эту публикацию?')) return;
    try {
      await deletePost(id);
      setPosts(current => current.filter(post => post.id !== id));
    } catch (err) {
      setError(err.message || 'Не удалось удалить публикацию');
    }
  }

  async function handleReaction(post, type) {
    setCommentBusy(current => ({ ...current, [post.id]: true }));
    try {
      const result = await togglePostReaction(post.id, type);
      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, myReaction: result.myReaction, reactionCounts: result.reactionCounts }
        : item));
      if (reactionDetails[post.id]?.open) {
        const details = await getPostReactions(post.id);
        setReactionDetails(current => ({ ...current, [post.id]: { open: true, reactions: details.reactions } }));
      }
    } catch (err) {
      setError(err.message || 'Не удалось изменить реакцию');
    } finally {
      setCommentBusy(current => ({ ...current, [post.id]: false }));
    }
  }

  async function toggleReactionDetails(postId) {
    const current = reactionDetails[postId];
    if (current?.open) {
      setReactionDetails(state => ({ ...state, [postId]: { ...state[postId], open: false } }));
      return;
    }
    try {
      const data = await getPostReactions(postId);
      setReactionDetails(state => ({ ...state, [postId]: { open: true, reactions: data.reactions } }));
    } catch (err) {
      setError(err.message || 'Не удалось загрузить список реакций');
    }
  }

  async function toggleComments(postId) {
    const opening = !expandedComments[postId];
    setExpandedComments(current => ({ ...current, [postId]: opening }));
    if (opening && !comments[postId]) {
      try {
        const data = await getPostComments(postId);
        setComments(current => ({ ...current, [postId]: data.comments }));
      } catch (err) {
        setError(err.message || 'Не удалось загрузить комментарии');
      }
    }
  }

  async function submitComment(event, postId) {
    event.preventDefault();
    const text = (commentDrafts[postId] || '').trim();
    if (!text || commentBusy[postId]) return;
    setCommentBusy(current => ({ ...current, [postId]: true }));
    try {
      const data = await createPostComment(postId, text);
      setComments(current => ({ ...current, [postId]: [...(current[postId] || []), data.comment] }));
      setPosts(current => current.map(post => post.id === postId
        ? { ...post, _count: { ...post._count, comments: (post._count?.comments || 0) + 1 } }
        : post));
      setCommentDrafts(current => ({ ...current, [postId]: '' }));
    } catch (err) {
      setError(err.message || 'Не удалось добавить комментарий');
    } finally {
      setCommentBusy(current => ({ ...current, [postId]: false }));
    }
  }

  async function removeComment(postId, commentId) {
    try {
      await deletePostComment(postId, commentId);
      setComments(current => ({ ...current, [postId]: current[postId].filter(comment => comment.id !== commentId) }));
      setPosts(current => current.map(post => post.id === postId
        ? { ...post, _count: { ...post._count, comments: Math.max(0, (post._count?.comments || 1) - 1) } }
        : post));
    } catch (err) {
      setError(err.message || 'Не удалось удалить комментарий');
    }
  }

  return <main className="page-content feed-page">
    <div className="welcome-row">
      <div><div className="eyebrow">СООБЩЕСТВО GAMEHUB</div><h1>Лента активности</h1><p>Новости, мысли и игровые моменты сообщества</p></div>
      <div className="feed-title-icon"><Newspaper size={22} /></div>
    </div>

    <form
      className={'feed-composer' + (isDragging ? ' is-dragging' : '')}
      onSubmit={submitPost}
      onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
      onDragLeave={event => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      <div className="composer-heading">
        <div className="composer-avatar">{user?.username?.[0]?.toUpperCase() || 'G'}</div>
        <div><strong>Поделись с сообществом</strong><span>Что нового в твоём игровом мире?</span></div>
      </div>
      <RichTextEditor
        editorRef={editorRef}
        onChange={handleEditorChange}
        onImagePaste={addImages}
        textLength={contentTextLength}
      />
      {attachments.length > 0 && <div className="feed-attachment-area">
        <div className="feed-attachment-heading"><span>Вложения</span><small>{attachments.length} из {MAX_POST_IMAGES}</small></div>
        <div className="feed-attachment-grid">
          {attachments.map((item, index) => <div className="feed-attachment-preview" key={item.id}>
            <img src={item.previewUrl} alt={'Предпросмотр ' + (index + 1)} />
            <span>{item.file.name || 'Скриншот ' + (index + 1)}</span>
            <button type="button" onClick={() => removeAttachment(item.id)} aria-label="Убрать изображение"><X size={14} /></button>
          </div>)}
        </div>
      </div>}
      <div className="feed-editor-footer">
        <div className="feed-editor-tools">
          <input
            ref={fileInputRef}
            className="feed-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            onChange={event => {
              addImages(event.target.files);
              event.target.value = '';
            }}
          />
          <button type="button" className="feed-attach-button" onClick={() => fileInputRef.current?.click()} disabled={attachments.length >= MAX_POST_IMAGES}>
            <ImagePlus size={16} /> Добавить изображения
          </button>
          <span className="feed-editor-hint"><ClipboardPaste size={13} /> Ctrl+V или перетащи скриншот сюда</span>
        </div>
        <div className="composer-footer">
          <span className={contentTextLength > 1000 ? 'over-limit' : ''}>{contentTextLength}/1000</span>
          <button className="primary-button" type="submit" disabled={(!content.trim() && !attachments.length) || contentTextLength > 1000 || posting}>
            <Send size={15} />{posting ? 'Загружаем...' : 'Опубликовать'}
          </button>
        </div>
      </div>
      <div className="feed-upload-limits">JPG, PNG, WEBP или GIF · до 4 изображений · максимум 8 МБ каждое</div>
    </form>

    <div className="feed-list-heading"><div><h2>Последние публикации</h2><p>Общайся с другими игроками</p></div><button className="feed-refresh" onClick={() => load()} title="Обновить"><RefreshCw size={16} /></button></div>
    {error && <div className="feed-error">{error}</div>}
    {loading ? <div className="feed-state">Загружаем публикации...</div> : posts.length === 0 ? <div className="feed-empty"><MessageSquare size={28} /><strong>Пока здесь тихо</strong><span>Стань первым, кто поделится новостью!</span></div> : <div className="feed-posts">
      {posts.map(post => <article id={'feed-post-' + post.id} className="feed-post" key={post.id}>
        <div className="feed-post-head"><Avatar author={post.author} /><div className="feed-author"><Link to={post.authorId === user?.id ? '/profile' : `/profile?user=${encodeURIComponent(post.author.username)}`}>{post.author.username}</Link><time>{formatDate(post.createdAt)}{post.updatedAt && new Date(post.updatedAt) > new Date(post.createdAt) ? ' · изменено' : ''}</time></div>
          {post.authorId === user?.id && <>
            {editingPostId !== post.id && <button className="feed-edit-trigger" onClick={() => setEditingPostId(post.id)} title="Редактировать публикацию"><Pencil size={15} /></button>}
            <button className="feed-delete" onClick={() => removePost(post.id)} title="Удалить публикацию"><Trash2 size={16} /></button>
          </>}
        </div>
        {editingPostId === post.id ? (
          <EditPostForm
            post={post}
            onCancel={() => setEditingPostId(null)}
            onSaved={updatedPost => {
              setPosts(current => current.map(item => item.id === updatedPost.id ? updatedPost : item));
              setEditingPostId(null);
            }}
          />
        ) : <>
        {post.content && renderPostContent(post.content)}
        {post.images?.length > 0 && <div className={'feed-post-gallery count-' + Math.min(post.images.length, 4)}>
          {post.images.map((image, index) => <button type="button" className="feed-post-image" key={image.id} onClick={() => setLightboxImage(getAssetUrl(image.url))} aria-label="Открыть изображение">
            <img src={getAssetUrl(image.url)} alt={'Изображение публикации ' + (index + 1)} loading="lazy" />
          </button>)}
        </div>}
        <div className="feed-actions feed-actions-expanded">
          <div className="feed-reaction-picker" aria-label="Реакции">
            {[
              ['FIRE', '🔥', 'Огонь'], ['HEART', '❤️', 'Нравится'], ['LAUGH', '😂', 'Смешно'],
              ['WOW', '😮', 'Удивительно'], ['SAD', '😢', 'Грустно'],
            ].map(([type, emoji, label]) => (
              <button
                type="button"
                key={type}
                className={'feed-reaction' + (post.myReaction === type ? ' is-selected' : '')}
                onClick={() => handleReaction(post, type)}
                disabled={commentBusy[post.id]}
                title={label}
                aria-label={label + ': ' + (post.reactionCounts?.[type] || 0)}
              >
                <span>{emoji}</span><b>{post.reactionCounts?.[type] || 0}</b>
              </button>
            ))}
            <button type="button" className="feed-reaction-people" onClick={() => toggleReactionDetails(post.id)}>
              Кто реагировал
            </button>
          </div>
          <button className="feed-action" onClick={() => toggleComments(post.id)}>
            <MessageSquare size={16} /> Комментарии <span>{post._count?.comments || 0}</span>
          </button>
        </div>
        {reactionDetails[post.id]?.open && (
          <div className="feed-reaction-details">
            {reactionDetails[post.id].reactions.length === 0 ? <span>Пока никто не отреагировал</span> :
              reactionDetails[post.id].reactions.map((reaction, index) => (
                <div className="feed-reaction-person" key={reaction.user.id + '-' + reaction.type}>
                  <span>{({ FIRE: '🔥', HEART: '❤️', LAUGH: '😂', WOW: '😮', SAD: '😢' })[reaction.type]}</span>
                  <Link to={reaction.user.id === user?.id ? '/profile' : '/profile?user=' + encodeURIComponent(reaction.user.username)}>
                    {reaction.user.username}
                  </Link>
                </div>
              ))}
          </div>
        )}
        </>}
        {expandedComments[post.id] && <section className="feed-comments">
          {(comments[post.id] || []).map(comment => <div className="feed-comment" key={comment.id}>
            <Avatar author={comment.author} />
            <div className="feed-comment-body"><div><Link to={comment.authorId === user?.id ? '/profile' : `/profile?user=${encodeURIComponent(comment.author.username)}`}>{comment.author.username}</Link><time>{formatDate(comment.createdAt)}</time></div><p>{comment.content}</p></div>
            {comment.authorId === user?.id && <button className="feed-comment-delete" onClick={() => removeComment(post.id, comment.id)} title="Удалить комментарий"><Trash2 size={14} /></button>}
          </div>)}
          <form className="feed-comment-form" onSubmit={event => submitComment(event, post.id)}>
            <input value={commentDrafts[post.id] || ''} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} maxLength={500} placeholder="Написать комментарий..." />
            <button type="submit" disabled={!(commentDrafts[post.id] || '').trim() || commentBusy[post.id]}><Send size={15} /></button>
          </form>
        </section>}
      </article>)}
    </div>}
    {!loading && cursor && <button className="feed-more" onClick={() => load(cursor)} disabled={loadingMore}>{loadingMore ? 'Загружаем...' : 'Загрузить ещё'}</button>}

    {lightboxImage && <div className="feed-image-lightbox" role="dialog" aria-modal="true" aria-label="Просмотр изображения" onClick={() => setLightboxImage('')}>
      <button type="button" className="feed-image-lightbox-close" onClick={() => setLightboxImage('')} aria-label="Закрыть"><X size={22} /></button>
      <img src={lightboxImage} alt="Полноразмерное изображение" onClick={event => event.stopPropagation()} />
    </div>}
  </main>;
}
