import {
  Bell, Search, ArrowRight, LogOut, CheckCheck, MessageCircle, Heart, Flame, Laugh, Eye, Frown, AtSign,
  UserPlus, Users, X, MonitorCheck,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import {
  getNotifications, markAllNotificationsRead, markNotificationRead, sendHeartbeat,
} from '../../services/api.js';
import Sidebar from './Sidebar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

function notificationText(type) {
  switch (type) {
    case 'COMMENT': return 'прокомментировал вашу публикацию';
    case 'COMMENT_REPLY': return 'ответил на ваш комментарий';
    case 'MENTION': return 'упомянул вас в комментарии';
    case 'MESSAGE': return 'отправил вам сообщение';
    case 'LIKE': return 'поставил лайк вашей публикации';
    case 'REACTION_FIRE': return 'поставил реакцию 🔥 на вашу публикацию';
    case 'REACTION_HEART': return 'поставил реакцию ❤️ на вашу публикацию';
    case 'REACTION_LAUGH': return 'поставил реакцию 😂 на вашу публикацию';
    case 'REACTION_WOW': return 'поставил реакцию 😮 на вашу публикацию';
    case 'REACTION_SAD': return 'поставил реакцию 😢 на вашу публикацию';
    case 'FRIEND_REQUEST': return 'отправил заявку в друзья';
    case 'FRIEND_ACCEPTED': return 'принял вашу заявку в друзья';
    default: return 'оставил новое уведомление';
  }
}

function notificationTitle(type) {
  switch (type) {
    case 'COMMENT': return 'Новый комментарий';
    case 'COMMENT_REPLY': return 'Ответ на комментарий';
    case 'MENTION': return 'Вас упомянули';
    case 'MESSAGE': return 'Новое сообщение';
    case 'LIKE': return 'Новый лайк';
    case 'REACTION_FIRE': return 'Новая реакция: 🔥';
    case 'REACTION_HEART': return 'Новая реакция: ❤️';
    case 'REACTION_LAUGH': return 'Новая реакция: 😂';
    case 'REACTION_WOW': return 'Новая реакция: 😮';
    case 'REACTION_SAD': return 'Новая реакция: 😢';
    case 'FRIEND_REQUEST': return 'Заявка в друзья';
    case 'FRIEND_ACCEPTED': return 'Новая дружба';
    default: return 'Новое уведомление';
  }
}

function NotificationIcon({ type, size = 18 }) {
  const props = { size, strokeWidth: 2 };
  switch (type) {
    case 'COMMENT':
    case 'COMMENT_REPLY': return <MessageCircle {...props} />;
    case 'MENTION': return <AtSign {...props} />;
    case 'MESSAGE': return <MessageCircle {...props} />;
    case 'LIKE':
    case 'REACTION_HEART': return <Heart {...props} />;
    case 'REACTION_FIRE': return <Flame {...props} />;
    case 'REACTION_LAUGH': return <Laugh {...props} />;
    case 'REACTION_WOW': return <Eye {...props} />;
    case 'REACTION_SAD': return <Frown {...props} />;
    case 'FRIEND_REQUEST': return <UserPlus {...props} />;
    case 'FRIEND_ACCEPTED': return <Users {...props} />;
    default: return <Bell {...props} />;
  }
}

function notificationTarget(notification) {
  if (notification.type === 'MESSAGE' && notification.conversationId) {
    return '/messages?conversation=' + encodeURIComponent(notification.conversationId);
  }
  if (['COMMENT', 'COMMENT_REPLY', 'MENTION'].includes(notification.type)
    && notification.postId && notification.commentId) {
    return '/feed?post=' + encodeURIComponent(notification.postId)
      + '&comment=' + encodeURIComponent(notification.commentId);
  }
  if (notification.type.startsWith('REACTION_') && notification.postId) {
    return '/feed?post=' + encodeURIComponent(notification.postId);
  }
  return notification.type === 'FRIEND_REQUEST' || notification.type === 'FRIEND_ACCEPTED' ? '/friends' : '/feed';
}

function formatNotificationDate(value) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function NotificationToast({ item, onOpen, onClose }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onClose(item.id), 7000);
    return () => window.clearTimeout(timer);
  }, [item.id, onClose]);

  return (
    <article className={`notification-toast toast-${item.type.toLowerCase()}`}>
      <button className="notification-toast-main" onClick={() => onOpen(item)}>
        <span className="notification-toast-icon"><NotificationIcon type={item.type} size={19} /></span>
        <span className="notification-toast-content">
          <strong>{notificationTitle(item.type)}</strong>
          <span><b>{item.actor.username}</b> {notificationText(item.type)}</span>
          <small>Открыть уведомление <span aria-hidden="true">→</span></small>
        </span>
        {item.actor.avatarUrl
          ? <img className="notification-toast-avatar" src={item.actor.avatarUrl} alt="" />
          : <span className="notification-toast-avatar fallback">{item.actor.username?.[0]?.toUpperCase() || '?'}</span>}
      </button>
      <button className="notification-toast-close" aria-label="Закрыть" onClick={() => onClose(item.id)}><X size={14} /></button>
      <span className="notification-toast-progress" />
    </article>
  );
}

function getInitialPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return window.Notification.permission;
}

function wasShownInAnotherTab(userId, notificationId) {
  const key = `gamehub:notification:shown:${userId}:${notificationId}`;
  try {
    if (window.localStorage.getItem(key)) return true;
    window.localStorage.setItem(key, String(Date.now()));
    return false;
  } catch {
    return false;
  }
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.username?.charAt(0)?.toUpperCase() || 'G';
  const [gameSearchQuery, setGameSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [activeNotificationTab, setActiveNotificationTab] = useState('unread');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(getInitialPermission);
  const [toasts, setToasts] = useState([]);
  const knownNotificationIds = useRef(new Set());
  const notificationBaselineReady = useRef(false);
  const visibleNotifications = activeNotificationTab === 'unread'
    ? notifications.filter(notification => !notification.readAt)
    : notifications;

  function submitGameSearch(event) {
    event.preventDefault();
    const params = new URLSearchParams({ tab: 'catalog' });
    const query = gameSearchQuery.trim();
    params.set('q', query);
    navigate('/library?' + params.toString());
  }

  const closeToast = useCallback((id) => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  const openNotification = useCallback(async (notification) => {
    setNotificationsOpen(false);
    closeToast(notification.id);
    try {
      if (!notification.readAt) {
        await markNotificationRead(notification.id);
        setNotifications(current => current.map(item => item.id === notification.id
          ? { ...item, readAt: new Date().toISOString() }
          : item));
        setUnreadCount(current => Math.max(0, current - 1));
      }
    } catch {
      setNotificationsError('Не удалось отметить уведомление прочитанным');
    }
    navigate(notificationTarget(notification));
  }, [closeToast, navigate]);

  const announceNotification = useCallback((notification) => {
    if (!user?.id || wasShownInAnotherTab(user.id, notification.id)) return;

    const body = `${notification.actor.username} ${notificationText(notification.type)}`;
    if (document.hidden && notificationPermission === 'granted' && 'Notification' in window) {
      try {
        const desktopNotification = new window.Notification(notificationTitle(notification.type), {
          body,
          icon: notification.actor.avatarUrl || '/favicon.ico',
          tag: `gamehub-${notification.id}`,
          renotify: false,
        });
        desktopNotification.onclick = () => {
          window.focus();
          openNotification(notification);
          desktopNotification.close();
        };
        return;
      } catch {
        // Fall back to the in-app toast if the browser cannot show a desktop notification.
      }
    }

    setToasts(current => [...current.filter(item => item.id !== notification.id), notification].slice(-4));
  }, [openNotification, notificationPermission, user?.id]);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await getNotifications(50);
      const items = data.notifications || [];

      if (!notificationBaselineReady.current) {
        knownNotificationIds.current = new Set(items.map(item => item.id));
        notificationBaselineReady.current = true;
      } else {
        const freshItems = items.filter(item =>
          !knownNotificationIds.current.has(item.id) && !item.readAt
        );
        for (const item of freshItems) announceNotification(item);
        for (const item of items) knownNotificationIds.current.add(item.id);
      }

      setNotifications(items);
      setUnreadCount(data.unreadCount || 0);
      setNotificationsError('');
    } catch {
      // Keep the rest of the app usable when the notification request briefly fails.
    }
  }, [announceNotification]);

  useEffect(() => {
    if (!user?.id) return;
    knownNotificationIds.current = new Set();
    notificationBaselineReady.current = false;
    sendHeartbeat().catch(() => {});
    loadNotifications();
    const heartbeatTimer = setInterval(() => sendHeartbeat().catch(() => {}), 30000);
    const notificationsTimer = setInterval(loadNotifications, 15000);
    const handleVisibility = () => {
      if (!document.hidden) loadNotifications();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(notificationsTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, loadNotifications]);

  useEffect(() => {
    const baseTitle = 'GameHub';
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle} — новые уведомления` : baseTitle;
    return () => { document.title = baseTitle; };
  }, [unreadCount]);

  async function enableBrowserNotifications() {
    if (!('Notification' in window)) {
      setNotificationPermission('unsupported');
      return;
    }
    try {
      const permission = await window.Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission === 'granted') {
        const testNotification = new window.Notification('GameHub', {
          body: 'Готово! Теперь уведомления будут приходить, даже когда открыта другая вкладка.',
          icon: '/favicon.ico',
          tag: 'gamehub-notifications-enabled',
        });
        window.setTimeout(() => testNotification.close(), 4500);
      }
    } catch {
      setNotificationsError('Браузер не смог включить системные уведомления');
    }
  }

  async function markAllRead() {
    setNotificationsLoading(true);
    setNotificationsError('');
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications(current => current.map(item => ({ ...item, readAt: item.readAt || now })));
      setUnreadCount(0);
    } catch {
      setNotificationsError('Не удалось обновить уведомления');
    } finally {
      setNotificationsLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">Игровая платформа <span>/</span> <strong>Обзор</strong></div>
          <div className="topbar-actions">
            <form className="search-box" onSubmit={submitGameSearch} role="search">
              <Search size={17} />
              <input
                value={gameSearchQuery}
                onChange={event => setGameSearchQuery(event.target.value)}
                placeholder="Найти игру..."
                aria-label="Поиск игры в каталоге"
              />
              <button type="submit" className="search-submit" aria-label="Открыть поиск игр"><ArrowRight size={14} /></button>
            </form>
            <div className="notification-anchor">
              <button
                className={`icon-button notification-trigger${unreadCount > 0 ? ' has-unread' : ''}`}
                aria-label={`Уведомления: ${unreadCount} непрочитанных`}
                aria-expanded={notificationsOpen}
                onClick={() => { setNotificationsOpen(open => !open); setNotificationsError(''); }}
              >
                <Bell size={19} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notificationsOpen && <section className="notification-panel" aria-label="Уведомления">
                <div className="notification-panel-head">
                  <div><strong>Уведомления</strong><small>{unreadCount ? `Непрочитанных: ${unreadCount}` : 'Всё просмотрено'}</small></div>
                  {unreadCount > 0 && <button onClick={markAllRead} disabled={notificationsLoading}><CheckCheck size={14} />Прочитать все</button>}
                </div>
                <div className="notification-tabs" role="tablist" aria-label="Фильтр уведомлений">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeNotificationTab === 'unread'}
                    className={activeNotificationTab === 'unread' ? 'active' : ''}
                    onClick={() => setActiveNotificationTab('unread')}
                  >
                    Непрочитанные <span>{unreadCount > 99 ? '99+' : unreadCount}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeNotificationTab === 'all'}
                    className={activeNotificationTab === 'all' ? 'active' : ''}
                    onClick={() => setActiveNotificationTab('all')}
                  >
                    Все
                  </button>
                </div>
                <div className="notification-permission-row">
                  {notificationPermission === 'granted'
                    ? <span className="permission-enabled"><MonitorCheck size={14} /> Системные уведомления включены</span>
                    : notificationPermission === 'default'
                      ? <button className="permission-enable" onClick={enableBrowserNotifications}><Bell size={14} /> Включить уведомления браузера</button>
                      : notificationPermission === 'denied'
                        ? <span className="permission-blocked">Уведомления заблокированы в настройках браузера</span>
                        : <span className="permission-blocked">Системные уведомления не поддерживаются этим браузером</span>}
                </div>
                {notificationsError && <p className="notification-error">{notificationsError}</p>}
                {visibleNotifications.length === 0
                  ? <div className="notification-empty">
                      {activeNotificationTab === 'unread' ? <CheckCheck size={22} /> : <Bell size={22} />}
                      <strong>{activeNotificationTab === 'unread' ? 'Непрочитанных уведомлений нет' : 'Пока тихо'}</strong>
                      <span>{activeNotificationTab === 'unread' ? 'Новые события появятся здесь' : 'История уведомлений пока пуста'}</span>
                    </div>
                  : <div className="notification-list">
                    {visibleNotifications.map(notification => <button
                      key={notification.id}
                      className={`notification-item${notification.readAt ? '' : ' unread'}`}
                      onClick={() => openNotification(notification)}
                    >
                      <span className={`notification-list-icon icon-${notification.type.toLowerCase()}`}><NotificationIcon type={notification.type} size={16} /></span>
                      {notification.actor.avatarUrl
                        ? <img src={notification.actor.avatarUrl} alt="" />
                        : <span className="notification-avatar-fallback">{notification.actor.username?.[0]?.toUpperCase() || '?'}</span>}
                      <span className="notification-copy">
                        <span><strong>{notification.actor.username}</strong> {notificationText(notification.type)}</span>
                        <time>{formatNotificationDate(notification.createdAt)}</time>
                      </span>
                      {!notification.readAt && <i aria-label="Непрочитано" />}
                    </button>)}
                  </div>}
                <div className="notification-panel-foot">Обновляется автоматически каждые 15 секунд</div>
              </section>}
            </div>
            <div className="avatar avatar-small">{initial}</div>
            <button className="icon-button" aria-label="Выйти" title="Выйти" onClick={logout}><LogOut size={18}/></button>
          </div>
        </header>
        <div className="page-content"><Outlet /></div>
      </main>
      <div className="notification-toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map(item => <NotificationToast key={item.id} item={item} onOpen={openNotification} onClose={closeToast} />)}
      </div>
    </div>
  );
}
