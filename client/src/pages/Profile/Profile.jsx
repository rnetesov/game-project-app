import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Check, Edit3, Gamepad2, MessageCircle, ShieldCheck, Trophy, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getProfile, getUserGameLibrary, getFriendshipStatus, updateMyProfile, getAssetUrl } from '../../services/api.js';
import FriendAction from '../../components/FriendAction.jsx';
import '../Library/Library.css';

function initials(name = '') {
  return name.slice(0, 2).toUpperCase() || 'GH';
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewedUsername = searchParams.get('user') || user?.username;
  const isOwnProfile = viewedUsername === user?.username;
  const [profile, setProfile] = useState(user);
  const isViewedProfileLoaded = profile?.username === viewedUsername;
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState([]);
  const [friendship, setFriendship] = useState(null);
  const [libraryCounts, setLibraryCounts] = useState({ total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });

  useEffect(() => {
    if (!viewedUsername) return;
    let cancelled = false;
    setFriendship(null);
    Promise.all([getProfile(viewedUsername), getUserGameLibrary(viewedUsername)])
      .then(async ([profileResult, libraryResult]) => {
        if (cancelled) return;
        const data = profileResult.user;
        setProfile(data);
        setUsername(data.username);
        setBio(data.bio || '');
        setAvatarUrl(data.avatarUrl || '');
        setLibraryEntries(libraryResult.entries || []);
        setLibraryCounts(libraryResult.counts || { total: 0, PLAYING: 0, WANT_TO_PLAY: 0, COMPLETED: 0 });
        if (data.id !== user?.id) {
          const relationship = await getFriendshipStatus(data.id);
          if (!cancelled) setFriendship(relationship);
        } else {
          setFriendship(null);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.message);
      });
    return () => { cancelled = true; };
  }, [viewedUsername, user?.id]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { username: username.trim(), bio: bio.trim(), avatarUrl: avatarUrl.trim() || null };
      const { user: updated } = await updateMyProfile(payload);
      setProfile(updated);
      await refreshUser();
      setEditing(false);
      setMessage('Профиль успешно обновлён');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const created = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
    : 'Недавно';

  return (
    <div className="profile-page">
      <div className="profile-title-row">
        <div><div className="eyebrow">ТВОЯ ИГРОВАЯ ЛИЧНОСТЬ</div><h1>{isOwnProfile ? 'Профиль игрока' : 'Профиль пользователя'}</h1><p>{isOwnProfile ? 'Управляй своим профилем и показывай достижения.' : 'Информация об игроке GameHub.'}</p></div>
        {isOwnProfile && !editing && <button className="primary-button" onClick={() => { setEditing(true); setMessage(''); setError(''); }}><Edit3 size={16}/> Редактировать</button>}
        {!isOwnProfile && isViewedProfileLoaded && <div className="profile-social-actions">
          {friendship && <FriendAction userId={profile.id} relationship={friendship.relationship} requestId={friendship.requestId}/>}
          <button className="primary-button" onClick={() => navigate('/messages?userId=' + encodeURIComponent(profile.id))}><MessageCircle size={16}/> Написать сообщение</button>
        </div>}
      </div>

      <section className="profile-hero">
        <div className="profile-avatar-wrap">
          {profile?.avatarUrl ? <img className="profile-avatar-image" src={profile.avatarUrl} alt="Аватар" /> : <div className="profile-avatar-fallback">{initials(profile?.username)}</div>}
          <span className="profile-online-dot" title="В сети"/>
        </div>
        <div className="profile-identity">
          <span className="profile-label">GAMEHUB PLAYER</span>
          <h2>{profile?.username || 'Игрок'}</h2>
          <p>{profile?.bio || 'Этот игрок пока не добавил описание.'}</p>
          <div className="profile-meta"><span><ShieldCheck size={14}/> Участник с {created}</span><span><span className="level-dot"/> Уровень {profile?.level || 1}</span></div>
        </div>
        <div className="profile-level"><span>УРОВЕНЬ</span><strong>{profile?.level || 1}</strong><small>{profile?.xp || 0} XP</small></div>
      </section>

      {message && <div className="profile-success"><Check size={16}/>{message}</div>}
      {error && <div className="auth-error profile-message">{error}</div>}

      {isOwnProfile && editing && <form className="profile-edit-card" onSubmit={save}>
        <div className="section-heading"><div><h2>Редактирование профиля</h2><p>Измени публичную информацию об аккаунте.</p></div><button type="button" className="profile-close" onClick={() => setEditing(false)} aria-label="Закрыть"><X size={18}/></button></div>
        <label>Никнейм<input value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} maxLength={20} required /></label>
        <label>О себе<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} rows={3} placeholder="Расскажи немного о себе..."/></label>
        <label>Ссылка на аватар<input type="url" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://example.com/avatar.jpg"/></label>
        <div className="profile-form-footer"><span>{bio.length}/160 символов</span><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем...' : <><Check size={16}/> Сохранить изменения</>}</button></div>
      </form>}

      <div className="profile-stats-grid">
        <div className="profile-stat"><span className="stat-icon purple"><Gamepad2 size={20}/></span><div><small>Игр в библиотеке</small><strong>{libraryCounts.total}</strong><em>{libraryCounts.PLAYING} сейчас · {libraryCounts.COMPLETED} пройдено</em></div></div>
        <div className="profile-stat"><span className="stat-icon orange"><Trophy size={20}/></span><div><small>Достижения</small><strong>0</strong><em>Путь только начинается</em></div></div>
        <div className="profile-stat"><span className="stat-icon green"><Camera size={20}/></span><div><small>Дата регистрации</small><strong>{created}</strong><em>В GameHub</em></div></div>
      </div>
      <section className="profile-library">
        <div className="profile-library-heading">
          <div><h2>Игровая библиотека</h2><p>{libraryCounts.total} игр в коллекции</p></div>
          <button type="button" className="text-button" onClick={() => navigate('/library' + (isOwnProfile ? '' : '?user=' + encodeURIComponent(viewedUsername)))}>
            Вся библиотека <Gamepad2 size={15}/>
          </button>
        </div>
        {libraryEntries.length === 0 ? (
          <div className="profile-library-empty">
            <Gamepad2 size={25}/>
            <strong>{isOwnProfile ? 'Добавь первую игру в библиотеку' : 'Пока нет добавленных игр'}</strong>
            <span>{isOwnProfile ? 'Выбери игры из каталога и отметь, во что играешь или что хочешь пройти.' : 'Этот пользователь пока не собрал коллекцию.'}</span>
            {isOwnProfile && <button type="button" className="primary-button" onClick={() => navigate('/library')}>Открыть каталог</button>}
          </div>
        ) : (
          <div className="profile-library-grid">
            {libraryEntries.slice(0, 4).map(entry => (
              <article className="profile-library-card" key={entry.id}>
                <div className="profile-library-cover">
                  <div className="library-cover-fallback"><Gamepad2 size={24}/><span>{entry.game.title}</span></div>
                  {entry.game.coverUrl && <img src={getAssetUrl(entry.game.coverUrl)} alt={'Обложка ' + entry.game.title} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }}/>}
                </div>
                <div><strong>{entry.game.title}</strong><small className="profile-library-genre">{entry.game.genre}{entry.game.subGenre ? ' · ' + entry.game.subGenre : ''}</small><small className="profile-library-description">{entry.game.description}</small><span className={'library-status-label status-' + entry.status.toLowerCase()}>{({ PLAYING: 'Играю сейчас', WANT_TO_PLAY: 'Хочу пройти', COMPLETED: 'Пройдено' })[entry.status]}</span></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
