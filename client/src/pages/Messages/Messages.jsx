import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Users, ArrowDown, LoaderCircle, Search, Check, CheckCheck, Paperclip, X, FileText, Download, Trash2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import FriendAction from '../../components/FriendAction.jsx';
import {
  getConversations,
  getConversationMessages,
  getFriends,
  markConversationRead,
  openConversation,
  sendConversationMessage,
  getConversationAttachmentBlob,
  deleteConversationMessage,
  clearConversationHistory,
  searchPlayers,
} from '../../services/api.js';
import './messages.css';


const MAX_CHAT_FILES = 5;
const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024;
const MAX_CHAT_TOTAL_SIZE = 25 * 1024 * 1024;
const ALLOWED_CHAT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function PendingAttachment({ file, onRemove }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (!file.type.startsWith('image/')) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="messages-pending-file">
      {preview ? <img src={preview} alt="" /> : <span className="messages-file-icon"><FileText size={17} /></span>}
      <span className="messages-pending-file-copy"><strong>{file.name}</strong><small>{formatFileSize(file.size)}</small></span>
      <button type="button" onClick={onRemove} aria-label={'Убрать ' + file.name}><X size={14} /></button>
    </div>
  );
}

function MessageAttachment({ conversationId, attachment }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const isImage = attachment.mimeType.startsWith('image/');

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    getConversationAttachmentBlob(conversationId, attachment.id)
      .then(blob => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(err => {
        if (active) setError(err.message || 'Не удалось загрузить вложение');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [conversationId, attachment.id]);

  if (error) return <span className="messages-attachment-error">{attachment.originalName}: {error}</span>;
  if (!url) return <span className="messages-attachment-loading"><LoaderCircle size={13} className="messages-spin" /> {attachment.originalName}</span>;

  return isImage ? (
    <a className="messages-attachment-image" href={url} target="_blank" rel="noreferrer" title="Открыть изображение">
      <img src={url} alt={attachment.originalName} loading="lazy" />
      <span>{attachment.originalName}</span>
    </a>
  ) : (
    <a className="messages-attachment-file" href={url} download={attachment.originalName}>
      <span className="messages-file-icon"><FileText size={18} /></span>
      <span><strong>{attachment.originalName}</strong><small>{formatFileSize(attachment.size)}</small></span>
      <Download size={15} />
    </a>
  );
}

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
  const [pendingFiles, setPendingFiles] = useState([]);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const attachmentInputRef = useRef(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [clearingHistory, setClearingHistory] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState('');
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
    if ((!content && pendingFiles.length === 0) || !selectedId || sending) return;
    setSending(true);
    setError('');
    try {
      const data = await sendConversationMessage(selectedId, content, pendingFiles);
      shouldStickToBottom.current = true;
      setMessages(current => mergeMessages(current, [data.message]));
      setMessageText('');
      setPendingFiles([]);
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  }


  async function deleteMessage(message) {
    if (!selectedId || !message || message.senderId !== user?.id || message.deletedAt || deletingMessageId) return;
    if (!window.confirm('Удалить это сообщение у всех участников переписки?')) return;

    setDeletingMessageId(message.id);
    setError('');
    try {
      const result = await deleteConversationMessage(selectedId, message.id);
      setMessages(current => current.map(item => item.id === message.id
        ? { ...item, content: '', attachments: [], deletedAt: result.message?.deletedAt || new Date().toISOString(), readAt: null }
        : item));
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Не удалось удалить сообщение');
    } finally {
      setDeletingMessageId('');
    }
  }

  async function clearHistory() {
    if (!selectedId || clearingHistory) return;
    if (!window.confirm('Очистить историю этой переписки только у себя? Собеседник сохранит свои сообщения.')) return;

    setClearingHistory(true);
    setError('');
    try {
      await clearConversationHistory(selectedId);
      firstPageLoad.current = true;
      shouldStickToBottom.current = true;
      setMessages([]);
      setNextCursor(null);
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Не удалось очистить историю переписки');
    } finally {
      setClearingHistory(false);
    }
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;
    const next = [...pendingFiles];
    let validationMessage = '';
    for (const file of incoming) {
      if (!ALLOWED_CHAT_TYPES.has(file.type)) {
        validationMessage = file.name + ': неподдерживаемый тип файла.';
        continue;
      }
      if (file.size > MAX_CHAT_FILE_SIZE) {
        validationMessage = file.name + ': размер превышает 10 МБ.';
        continue;
      }
      if (next.length >= MAX_CHAT_FILES) {
        validationMessage = 'Можно прикрепить не более 5 файлов к одному сообщению.';
        break;
      }
      const duplicate = next.some(item =>
        item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
      );
      if (duplicate) continue;
      const totalSize = next.reduce((sum, item) => sum + item.size, 0) + file.size;
      if (totalSize > MAX_CHAT_TOTAL_SIZE) {
        validationMessage = 'Общий размер вложений не должен превышать 25 МБ.';
        continue;
      }
      next.push(file);
    }
    setPendingFiles(next);
    setError(validationMessage);
  }

  function handleAttachmentInput(event) {
    addFiles(event.target.files);
    event.target.value = '';
  }

  function handleComposerPaste(event) {
    const imageFiles = Array.from(event.clipboardData?.items || [])
      .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!imageFiles.length) return;
    event.preventDefault();
    addFiles(imageFiles);
  }

  function handleComposerDrop(event) {
    event.preventDefault();
    setDraggingFiles(false);
    addFiles(event.dataTransfer?.files);
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
                        <div className="messages-friend-profile">
                          <Avatar user={person} small />
                          <span><strong>{person.username}</strong><small>{person.relationship === 'FRIENDS' ? 'Уже в друзьях' : person.online ? 'В сети' : 'Игрок GameHub'}</small></span>
                        </div>
                        {person.relationship !== 'FRIENDS' && <FriendAction userId={person.id} relationship={person.relationship} requestId={person.requestId} compact/>}
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
                          <div className="messages-friend-profile">
                            <Avatar user={friend} small />
                            <span><strong>{friend.username}</strong><small>{friend.online ? 'В сети' : 'Не в сети'}</small></span>
                          </div>
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
                  <div className="messages-conversation-profile">
                    <Avatar user={item.otherUser} />
                    <strong>{item.otherUser?.username || 'Игрок'}</strong>
                  </div>
                  <button
                    type="button"
                    className="messages-conversation-open"
                    onClick={() => setSearchParams({ conversation: item.id })}
                    aria-label={'Открыть переписку с ' + (item.otherUser?.username || 'игроком')}
                  >
                    <small>{item.lastMessage
                      ? (item.lastMessage.deletedAt
                        ? 'Сообщение удалено'
                        : (item.lastMessage.senderId === user?.id ? 'Вы: ' : '') + item.lastMessage.content)
                      : item.historyClearedAt ? 'История очищена' : 'Начните общение'}</small>
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
                <div className="messages-chat-profile">
                  <Avatar user={selectedConversation.otherUser} small />
                  <span><strong>{selectedConversation.otherUser?.username || 'Игрок'}</strong><small>Личная переписка</small></span>
                </div>
                <button
                  type="button"
                  className="messages-clear-history"
                  onClick={clearHistory}
                  disabled={clearingHistory}
                  title="Очистить историю у себя"
                  aria-label="Очистить историю у себя"
                >
                  {clearingHistory ? <LoaderCircle size={15} className="messages-spin" /> : <Trash2 size={15} />}
                </button>
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
                      {!own && <strong className="messages-sender-name">{message.sender?.username}</strong>}
                      {message.deletedAt ? (
                        <p className="messages-deleted-message">Сообщение удалено</p>
                      ) : (
                        <>
                          {message.content && <p>{message.content}</p>}
                          {message.attachments?.length > 0 && (
                            <div className="messages-attachments">
                              {message.attachments.map(attachment => (
                                <MessageAttachment key={attachment.id} conversationId={selectedId} attachment={attachment} />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <div className="messages-bubble-footer">
                        {own && !message.deletedAt && (
                          <button
                            type="button"
                            className="messages-delete-message"
                            onClick={() => deleteMessage(message)}
                            disabled={deletingMessageId === message.id}
                            title="Удалить сообщение"
                            aria-label="Удалить сообщение"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                        <time>{formatTime(message.createdAt)}</time>
                        {own && !message.deletedAt && (
                          <span
                            className={'messages-read-receipt' + (message.readAt ? ' is-read' : '')}
                            title={message.readAt ? 'Прочитано собеседником' : 'Отправлено, ожидает прочтения'}
                            aria-label={message.readAt ? 'Прочитано' : 'Отправлено'}
                          >
                            {message.readAt ? <CheckCheck size={13} /> : <Check size={13} />}
                            <span>{message.readAt ? 'Прочитано' : 'Отправлено'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </article>;
                }) : <div className="messages-start-hint"><MessageCircle size={25}/><strong>{selectedConversation.historyClearedAt ? 'История очищена' : 'Начало переписки'}</strong><span>{selectedConversation.historyClearedAt ? 'Старые сообщения удалены только из твоей истории.' : 'Отправь первое сообщение.'}</span></div>}
                <div ref={bottomRef} />
              </div>
              <form
                className={'messages-composer' + (draggingFiles ? ' is-dragging-files' : '')}
                onSubmit={submitMessage}
                onDragOver={event => { event.preventDefault(); setDraggingFiles(true); }}
                onDragLeave={event => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setDraggingFiles(false);
                }}
                onDrop={handleComposerDrop}
              >
                <input
                  ref={attachmentInputRef}
                  className="messages-attachment-input"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,application/zip,.docx,.xlsx,.pptx"
                  onChange={handleAttachmentInput}
                  aria-label="Выбрать вложения"
                />
                {draggingFiles && <div className="messages-drop-overlay"><Paperclip size={20} /> Отпусти файлы, чтобы прикрепить</div>}
                {pendingFiles.length > 0 && (
                  <div className="messages-pending-files">
                    {pendingFiles.map((file, index) => (
                      <PendingAttachment key={file.name + '-' + file.size + '-' + file.lastModified} file={file} onRemove={() => setPendingFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} />
                    ))}
                  </div>
                )}
                <textarea
                  value={messageText}
                  onChange={event => setMessageText(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  onPaste={handleComposerPaste}
                  placeholder="Напиши сообщение... Вставь картинку Ctrl+V или прикрепи файл"
                  maxLength={2000}
                  rows={2}
                />
                <div className="messages-composer-footer">
                  <span>{messageText.length}/2000 · {pendingFiles.length}/5 файлов</span>
                  <div className="messages-composer-actions">
                    <button type="button" className="messages-attach-button" onClick={() => attachmentInputRef.current?.click()} disabled={sending} title="Прикрепить файлы" aria-label="Прикрепить файлы">
                      <Paperclip size={17} /> <span>Вложить</span>
                    </button>
                    <button type="submit" disabled={(!messageText.trim() && pendingFiles.length === 0) || sending}>
                      {sending ? <LoaderCircle size={16} className="messages-spin" /> : <Send size={16} />}
                      Отправить
                    </button>
                  </div>
                </div>
                <div className="messages-attachment-hint">До 5 файлов · 10 МБ каждый · всего до 25 МБ · изображения, PDF, TXT, ZIP, DOCX, XLSX, PPTX</div>
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
