import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, Search, UserMinus, UserPlus, Users, X, RefreshCw } from 'lucide-react';
import { getFriends, getFriendRequests, removeFriend, respondFriendRequest, searchPlayers, sendFriendRequest } from '../../services/api.js';

function Avatar({ user, size = 'normal' }) {
  return user.avatarUrl
    ? <img className={`friend-avatar ${size}`} src={user.avatarUrl} alt="" />
    : <div className={`friend-avatar fallback ${size}`}>{(user.username || 'G').slice(0, 2).toUpperCase()}</div>;
}
function Status({ online }) {
  return <span className={`friend-status ${online ? 'online' : ''}`}><i />{online ? 'В сети' : 'Не в сети'}</span>;
}
function PlayerCard({ user, action, secondary }) {
  return <div className="friend-card"><Avatar user={user}/><div className="friend-card-info"><strong>{user.username}</strong><small>Уровень {user.level || 1}</small><Status online={user.online}/></div><div className="friend-card-actions">{action}{secondary}</div></div>;
}
export default function Friends() {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [tab, setTab] = useState('friends');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([getFriends(), getFriendRequests()]);
      setFriends(f.friends);
      setRequests(r.requests);
    } catch (e) { setError(e.message); }
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }
    let active = true;
    const timer = setTimeout(() => searchPlayers(term).then(data => { if (active) setResults(data.users); }).catch(e => setError(e.message)), 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  async function run(key, fn, success) {
    setBusy(key); setError(''); setNotice('');
    try { await fn(); await load(); setNotice(success); if (query.trim().length >= 2) { const data = await searchPlayers(query.trim()); setResults(data.users); } }
    catch (e) { setError(e.message); }
    finally { setBusy(''); }
  }

  return <div className="friends-page">
    <div className="friends-heading"><div><div className="eyebrow">ТВОЁ ИГРОВОЕ СООБЩЕСТВО</div><h1>Друзья</h1><p>Находи игроков и собирай свою команду.</p></div><div className="friends-count"><Users size={18}/><strong>{friends.length}</strong><span>друзей</span></div></div>
    <div className="friends-search-panel"><div className="friends-search-title"><div><h2>Найти игроков</h2><p>Введи никнейм, чтобы найти знакомых в GameHub.</p></div><Search size={20}/></div><div className="friends-search-input"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Поиск по никнейму..." /><kbd>2+ символа</kbd></div>
      {query.trim().length >= 2 && <div className="friends-results">{results.length ? results.map(user => <PlayerCard key={user.id} user={user} action={
        user.relationship === 'FRIENDS' ? <span className="friend-pill">Уже друзья</span> :
        user.relationship === 'SENT' ? <span className="friend-pill">Заявка отправлена</span> :
        user.relationship === 'RECEIVED' ? <button className="friend-action accept" disabled={!!busy} onClick={() => run(user.id, () => sendFriendRequest(user.id), 'Заявка принята')}><Check size={15}/> Принять</button> :
        <button className="friend-action" disabled={!!busy} onClick={() => run(user.id, () => sendFriendRequest(user.id), 'Заявка отправлена')}><UserPlus size={15}/> Добавить</button>
      } />) : <div className="friends-no-results">Игроки не найдены</div>}</div>}
    </div>
    {error && <div className="friends-alert error">{error}</div>}{notice && <div className="friends-alert">{notice}</div>}
    <div className="friends-tabs"><button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>Мои друзья <span>{friends.length}</span></button><button className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>Заявки <span>{requests.length}</span></button></div>
    {tab === 'friends' ? <section className="friends-list">{friends.length ? friends.map(user => <PlayerCard key={user.id} user={user} action={<button className="friend-action remove" disabled={!!busy} onClick={() => run(user.id, () => removeFriend(user.id), 'Друг удалён')}><UserMinus size={15}/> Удалить</button>}/>) : <div className="friends-empty"><Users size={28}/><h3>Пока нет друзей</h3><p>Найди игроков выше и отправь им заявку в друзья.</p></div>}</section> :
    <section className="friends-list">{requests.length ? requests.map(({ id, user }) => <PlayerCard key={id} user={user} action={<><button className="friend-action accept" disabled={!!busy} onClick={() => run(id, () => respondFriendRequest(id, 'accept'), 'Заявка принята')}><Check size={15}/> Принять</button><button className="friend-action remove" disabled={!!busy} onClick={() => run(id, () => respondFriendRequest(id, 'decline'), 'Заявка отклонена')}><X size={15}/> Отклонить</button></>}/>) : <div className="friends-empty"><Clock3 size={28}/><h3>Нет новых заявок</h3><p>Входящие приглашения появятся здесь.</p></div>}</section>}
    <button className="friends-refresh" onClick={load}><RefreshCw size={14}/> Обновить список</button>
  </div>;
}
