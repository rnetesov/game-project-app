import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Send, Trash2, Newspaper, RefreshCw } from 'lucide-react';
import { createPost, deletePost, getPosts } from '../../services/api.js';
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
      </article>)}
    </div>}
    {!loading && cursor && <button className="feed-more" onClick={() => load(cursor)} disabled={loadingMore}>{loadingMore ? 'Загружаем...' : 'Загрузить ещё'}</button>}
  </main>;
}
