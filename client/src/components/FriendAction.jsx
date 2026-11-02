import { useEffect, useState } from 'react';
import { Check, Clock3, UserPlus, X } from 'lucide-react';
import { cancelFriendRequest, respondFriendRequest, sendFriendRequest } from '../services/api.js';

export default function FriendAction({ userId, relationship = 'NONE', requestId = null, compact = false }) {
  const [status, setStatus] = useState(relationship);
  const [currentRequestId, setCurrentRequestId] = useState(requestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus(relationship || 'NONE');
    setCurrentRequestId(requestId || null);
    setError('');
  }, [userId, relationship, requestId]);

  async function handleAction() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (status === 'NONE') {
        const result = await sendFriendRequest(userId);
        setStatus('SENT');
        setCurrentRequestId(result.request?.id || null);
      } else if (status === 'SENT') {
        if (!currentRequestId) throw new Error('Не удалось найти заявку для отмены. Обнови страницу.');
        await cancelFriendRequest(currentRequestId);
        setStatus('NONE');
        setCurrentRequestId(null);
      } else if (status === 'RECEIVED') {
        if (!currentRequestId) throw new Error('Не удалось найти входящую заявку. Обнови страницу.');
        await respondFriendRequest(currentRequestId, 'accept');
        setStatus('FRIENDS');
        setCurrentRequestId(null);
      }
    } catch (err) {
      setError(err.message || 'Не удалось изменить статус дружбы');
    } finally {
      setBusy(false);
    }
  }

  if (status === 'FRIENDS') {
    return <span className={'friend-action-status is-friends' + (compact ? ' is-compact' : '')}><Check size={14}/> Уже друзья</span>;
  }

  const sent = status === 'SENT';
  const received = status === 'RECEIVED';
  const label = sent ? 'Отменить заявку' : received ? 'Принять запрос' : 'Добавить в друзья';
  return (
    <span className={'friend-action-wrap' + (compact ? ' is-compact' : '')}>
      <button
        type="button"
        className={'friend-action-button' + (sent ? ' is-pending' : '') + (received ? ' is-accept' : '') + (compact ? ' is-compact' : '')}
        onClick={handleAction}
        disabled={busy}
        title={label}
      >
        {sent ? <X size={14}/> : received ? <Check size={14}/> : <UserPlus size={14}/>}
        {!compact && (busy ? 'Сохраняем...' : label)}
        {compact && <span>{busy ? '...' : sent ? 'Заявка' : received ? 'Принять' : 'В друзья'}</span>}
      </button>
      {error && <small className="friend-action-error">{error}</small>}
    </span>
  );
}
