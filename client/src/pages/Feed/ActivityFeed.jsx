import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send, Trash2, Newspaper, RefreshCw, Heart } from 'lucide-react';
import {
  createPost, deletePost, getPosts, togglePostLike,
  getPostComments, createPostComment, deletePostComment,
} from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './ActivityFeed.css';

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
  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [comments, setComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentBusy, setCommentBusy] = useState({});

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

  async function submitPost(event) {
    event.preventDefault();
    if (!content.trim() || posting) return;
    setPosting(true);
    setError('');
    try {
      const data = await createPost(content);
      setPosts(current => [data.post, ...current]);
      setContent('');
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

  async function handleLike(post) {
    setCommentBusy(current => ({ ...current, [post.id]: true }));
    try {
      const result = await togglePostLike(post.id);
      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, likedByMe: result.liked, _count: { ...item._count, likes: result.count } }
        : item));
    } catch (err) {
      setError(err.message || 'Не удалось изменить реакцию');
    } finally {
      setCommentBusy(current => ({ ...current, [post.id]: false }));
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

    <form className="feed-composer" onSubmit={submitPost}>
      <div className="composer-heading"><div className="composer-avatar">{user?.username?.[0]?.toUpperCase() || 'G'}</div><div><strong>Поделись с сообществом</strong><span>Что нового в твоём игровом мире?</span></div></div>
      <textarea value={content} onChange={event => setContent(event.target.value)} maxLength={1000} placeholder="Напиши что-нибудь..." rows={4} />
      <div className="composer-footer"><span>{content.length}/1000</span><button className="primary-button" type="submit" disabled={!content.trim() || posting}><Send size={15} />{posting ? 'Публикуем...' : 'Опубликовать'}</button></div>
    </form>

    <div className="feed-list-heading"><div><h2>Последние публикации</h2><p>Общайся с другими игроками</p></div><button className="feed-refresh" onClick={() => load()} title="Обновить"><RefreshCw size={16} /></button></div>
    {error && <div className="feed-error">{error}</div>}
    {loading ? <div className="feed-state">Загружаем публикации...</div> : posts.length === 0 ? <div className="feed-empty"><MessageSquare size={28} /><strong>Пока здесь тихо</strong><span>Стань первым, кто поделится новостью!</span></div> : <div className="feed-posts">
      {posts.map(post => <article className="feed-post" key={post.id}>
        <div className="feed-post-head"><Avatar author={post.author} /><div className="feed-author"><Link to={post.authorId === user?.id ? '/profile' : `/profile?user=${encodeURIComponent(post.author.username)}`}>{post.author.username}</Link><time>{formatDate(post.createdAt)}</time></div>
          {post.authorId === user?.id && <button className="feed-delete" onClick={() => removePost(post.id)} title="Удалить публикацию"><Trash2 size={16} /></button>}
        </div>
        <p className="feed-post-content">{post.content}</p>
        <div className="feed-actions">
          <button className={post.likedByMe ? 'feed-action is-liked' : 'feed-action'} onClick={() => handleLike(post)} disabled={commentBusy[post.id]}>
            <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} /> Нравится <span>{post._count?.likes || 0}</span>
          </button>
          <button className="feed-action" onClick={() => toggleComments(post.id)}>
            <MessageSquare size={16} /> Комментарии <span>{post._count?.comments || 0}</span>
          </button>
        </div>
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
  </main>;
}
