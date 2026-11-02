import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Users, ArrowDown, LoaderCircle, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  getConversations,
  getConversationMessages,
  getFriends,
  markConversationRead,
  openConversation,
  sendConversationMessage,
  searchPlayers,
} from '../../services/api.js';
import './messages.css';

function Avatar({ user, small = false }) {
  const className = 'messages-avatar' + (small ? ' small' : '');
  if (user?.avatarUrl) return <img className={className} src={user.avatarUrl} alt="" />;
  return <span className={className + ' fallback'}>{(user?.username || '?').slice(0, 1).toUpperCase()}</span>;
}

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDay(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(value));
}

function mergeMessages(current, incoming) {
  const byId = new Map();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => {
    const dateDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dateDiff || a.id.localeCompare(b.id);
  });
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conversation') || '';
  const requestedUserId = searchParams.get('userId') || '';
  const handledProfileUserId = useRef('');
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const [playerQuery, setPlayerQuery] = useState('');
  const [playerResults, setPlayerResults] = useState([]);
  const [searchingPlayers, setSearchingPlayers] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const shouldStickToBottom = useRef(true);
  const firstPageLoad = useRef(true);

  const selectedConversation = conversations.find(item => item.id === selectedId) || null;

  const loadConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data.conversations || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Не удалось загрузить диалоги');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const timer = window.setInterval(loadConversations, 5000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    if (!requestedUserId || selectedId || handledProfileUserId.current === requestedUserId) return;
    handledProfileUserId.current = requestedUserId;

    openConversation(requestedUserId)
      .then(async data => {
        setSearchParams({ conversation: data.conversation.id }, { replace: true });
        await loadConversations();
      })
      .catch(err => {
        setError(err.message || 'Не удалось открыть переписку с этим пользователем');
        setSearchParams({}, { replace: true });
      });
  }, [requestedUserId, selectedId, setSearchParams, loadConversations]);

  useEffect(() => {
    if (!showFriends || friendsLoaded) return;
    getFriends()
      .then(data => setFriends(data.friends || []))
      .catch(err => setError(err.message || 'Не удалось загрузить друзей'))
      .finally(() => setFriendsLoaded(true));
  }, [showFriends, friendsLoaded]);

  useEffect(() => {
    const term = playerQuery.trim();
    if (term.length < 2) {
      setPlayerResults([]);
      setSearchingPlayers(false);
      return undefined;
    }

    let active = true;
    setSearchingPlayers(true);
    const timer = window.setTimeout(() => {
      searchPlayers(term)
        .then(data => { if (active) setPlayerResults(data.users || []); })
        .catch(err => { if (active) setError(err.message || 'Не удалось найти игроков'); })
        .finally(() => { if (active) setSearchingPlayers(false); });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [playerQuery]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setNextCursor(null);
      return undefined;
    }

    let active = true;
    firstPageLoad.current = true;
    shouldStickToBottom.current = true;

    const loadMessages = async () => {
      try {
        const data = await getConversationMessages(selectedId);
        if (!active) return;
        const element = listRef.current;
        shouldStickToBottom.current = !element
          || element.scrollHeight - element.scrollTop - element.clientHeight < 120;

        if (firstPageLoad.current) {
          setMessages(data.messages || []);
          setNextCursor(data.nextCursor || null);
          firstPageLoad.current = false;
        } else {
          setMessages(current => mergeMessages(current, data.messages || []));
        }
        markConversationRead(selectedId).catch(() => {});
        loadConversations();
      } catch (err) {
        if (active) setError(err.message || 'Не удалось загрузить сообщения');
      }
    };

    setMessages([]);
    setNextCursor(null);
    loadMessages();
    const timer = window.setInterval(loadMessages, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId, loadConversations]);

  useEffect(() => {
    if (shouldStickToBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages]);

  async function startConversation(targetUser) {
    setError('');
    try {
      const data = await openConversation(targetUser.id);
      setSearchParams({ conversation: data.conversation.id });
      setShowFriends(false);
      setPlayerQuery('');
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Не удалось открыть диалог');
    }
  }

  async function loadOlder() {
    if (!selectedId || !nextCursor || loadingOlder) return;
    setLoadingOlder(true);
    const previousHeight = listRef.current?.scrollHeight || 0;
    try {
      const data = await getConversationMessages(selectedId, { before: nextCursor });
      shouldStickToBottom.current = false;
      setMessages(current => mergeMessages(data.messages || [], current));
      setNextCursor(data.nextCursor || null);
      requestAnimationFrame(() => {
        if (listRef.current) listRef.current.scrollTop += listRef.current.scrollHeight - previousHeight;
      });
    } catch (err) {
      setError(err.message || 'Не удалось загрузить историю');
    } finally {
      setLoadingOlder(false);
    }
  }

  async function submitMessage(event) {
    event.preventDefault();
    const content = messageText.trim();
    if (!content || !selectedId || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await sendConversationMessage(selectedId, content);
      shouldStickToBottom.current = true;
      setMessages(current => mergeMessages(current, [data.message]));
      setMessageText('');
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  const peopleToShow = playerQuery.trim().length >= 2 ? playerResults : friends;

  return (
    <div className="messages-page">
      <div className="messages-heading">
        <div>
          <div className="eyebrow">ОБЩАЙСЯ СО СВОИМ СООБЩЕСТВОМ</div>
          <h1>Сообщения</h1>
          <p>Личные переписки с любыми игроками GameHub.</p>
        </div>
        <button className="messages-new-button" onClick={() => setShowFriends(value => !value)}>
          <Plus size={17} /> Новый диалог
        </button>
      </div>

      {error && <div className="messages-alert">{error}</div>}

      {showFriends && (
        <section className="messages-friend-picker">
          <div className="messages-picker-heading">
            <div><strong>Кому написать?</strong><span>Можно начать переписку с любым зарегистрированным игроком, не только с друзьями.</span></div>
            <button onClick={() => setShowFriends(false)} aria-label="Закрыть">×</button>
          </div>
          <label className="messages-user-search">
            <Search size={16} />
            <input
              value={playerQuery}
              onChange={event => setPlayerQuery(event.target.value)}
              placeholder="Найти игрока по никнейму..."
              maxLength={20}
            />
          </label>
          {playerQuery.trim().length >= 2
            ? searchingPlayers
              ? <div className="messages-picker-empty">Ищем игроков...</div>
              : playerResults.length
                ? <div className="messages-friend-list">
                    {peopleToShow.map(person => (
                      <div key={person.id} className="messages-friend-option">
                        <Link className="messages-friend-profile" to={'/profile?user=' + encodeURIComponent(person.username)}>
                          <Avatar user={person} small />
                          <span><strong>{person.username}</strong><small>{person.relationship === 'FRIENDS' ? 'Уже в друзьях' : person.online ? 'В сети' : 'Игрок GameHub'}</small></span>
                        </Link>
                        <button type="button" className="messages-friend-message" onClick={() => startConversation(person)} title={'Написать ' + person.username} aria-label={'Написать ' + person.username}>
                          <MessageCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                : <div className="messages-picker-empty">Игроков с таким никнеймом не найдено.</div>
            : !friendsLoaded
              ? <div className="messages-picker-empty">Загружаем друзей...</div>
              : friends.length
                ? <>
                    <div className="messages-suggested-label">Или начни с друга</div>
                    <div className="messages-friend-list">
                      {friends.map(friend => (
                        <div key={friend.id} className="messages-friend-option">
                          <Link className="messages-friend-profile" to={'/profile?user=' + encodeURIComponent(friend.username)}>
                            <Avatar user={friend} small />
                            <span><strong>{friend.username}</strong><small>{friend.online ? 'В сети' : 'Не в сети'}</small></span>
                          </Link>
                          <button type="button" className="messages-friend-message" onClick={() => startConversation(friend)} title={'Написать ' + friend.username} aria-label={'Написать ' + friend.username}>
                            <MessageCircle size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                : <div className="messages-picker-empty">Введи никнейм, чтобы найти любого игрока GameHub.</div>}
        </section>
      )}

      <section className="messages-layout">
        <aside className="messages-conversation-panel">
          <div className="messages-panel-title"><strong>Диалоги</strong><span>{conversations.length}</span></div>
          <div className="messages-conversation-list">
            {loading ? <div className="messages-list-empty">Загружаем...</div>
              : conversations.length ? conversations.map(item => (
                <div
                  key={item.id}
                  className={'messages-conversation-item' + (item.id === selectedId ? ' active' : '')}
                >
                  <Link className="messages-conversation-profile" to={'/profile?user=' + encodeURIComponent(item.otherUser?.username || '')}>
                    <Avatar user={item.otherUser} />
                    <strong>{item.otherUser?.username || 'Игрок'}</strong>
                  </Link>
                  <button
                    type="button"
                    className="messages-conversation-open"
                    onClick={() => setSearchParams({ conversation: item.id })}
                    aria-label={'Открыть переписку с ' + (item.otherUser?.username || 'игроком')}
                  >
                    <small>{item.lastMessage
                      ? (item.lastMessage.senderId === user?.id ? 'Вы: ' : '') + item.lastMessage.content
                      : 'Начните общение'}</small>
                  </button>
                  <span className="messages-conversation-meta">
                    <time>{formatDay(item.lastMessage?.createdAt || item.updatedAt)}</time>
                    {item.unreadCount > 0 && <i>{item.unreadCount > 99 ? '99+' : item.unreadCount}</i>}
                  </span>
                </div>
              )) : <div className="messages-list-empty"><MessageCircle size={24}/><strong>Пока нет диалогов</strong><span>Нажми «Новый диалог», чтобы написать любому игроку.</span></div>}
          </div>
        </aside>

        <section className="messages-chat-panel">
          {selectedConversation ? (
            <>
              <header className="messages-chat-header">
                <Link className="messages-chat-profile" to={'/profile?user=' + encodeURIComponent(selectedConversation.otherUser?.username || '')}>
                  <Avatar user={selectedConversation.otherUser} small />
                  <span><strong>{selectedConversation.otherUser?.username || 'Игрок'}</strong><small>Открыть профиль · Личная переписка</small></span>
                </Link>
              </header>
              <div className="messages-history" ref={listRef}>
                {nextCursor && <button className="messages-load-older" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder ? <LoaderCircle size={14} className="messages-spin" /> : <ArrowDown size={14} />}
                  Загрузить предыдущие сообщения
                </button>}
                {messages.length ? messages.map(message => {
                  const own = message.senderId === user?.id;
                  return <article key={message.id} className={'messages-bubble-row' + (own ? ' own' : '')}>
                    {!own && <Avatar user={message.sender} small />}
                    <div className="messages-bubble">
                      {!own && <Link className="messages-sender-profile" to={'/profile?user=' + encodeURIComponent(message.sender?.username || '')}>{message.sender?.username}</Link>}
                      <p>{message.content}</p>
                      <time>{formatTime(message.createdAt)}</time>
                    </div>
                  </article>;
                }) : <div className="messages-start-hint"><MessageCircle size={25}/><strong>Начало переписки</strong><span>Отправь первое сообщение.</span></div>}
                <div ref={bottomRef} />
              </div>
              <form className="messages-composer" onSubmit={submitMessage}>
                <textarea
                  value={messageText}
                  onChange={event => setMessageText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Напиши сообщение... (Enter — отправить, Shift + Enter — перенос строки)"
                  maxLength={2000}
                  rows={2}
                />
                <div className="messages-composer-footer">
                  <span>{messageText.length}/2000</span>
                  <button type="submit" disabled={!messageText.trim() || sending}>
                    {sending ? <LoaderCircle size={16} className="messages-spin" /> : <Send size={16} />}
                    Отправить
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="messages-empty-chat">
              <span className="messages-empty-icon"><Users size={28}/></span>
              <h2>Твоё сообщество на связи</h2>
              <p>Выбери диалог слева или найди любого игрока, чтобы начать переписку.</p>
              <button onClick={() => setShowFriends(true)}><Plus size={16}/> Новый диалог</button>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
