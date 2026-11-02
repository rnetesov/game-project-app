import { ArrowUpRight, Gamepad2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAssetUrl } from '../../services/api.js';

const STATUS_LABELS = {
  PLAYING: 'Играю сейчас',
  WANT_TO_PLAY: 'Хочу пройти',
  COMPLETED: 'Пройдено',
};

export default function GameCard({ game, status }) {
  const category = [game.genre, game.subGenre].filter(Boolean).join(' · ');

  return (
    <article className="game-card">
      <div className="game-cover" style={{ background: 'linear-gradient(135deg,#7771e8,#34365f)' }}>
        {game.coverUrl && (
          <img
            className="game-cover-image"
            src={getAssetUrl(game.coverUrl)}
            alt={'Обложка ' + game.title}
            loading="lazy"
            onError={event => { event.currentTarget.style.display = 'none'; }}
          />
        )}
        <span className="cover-label">{category || 'ИГРА'}</span>
        <div className="cover-art"><Gamepad2 size={56} strokeWidth={1.2} /></div>
      </div>
      <div className="game-info">
        <div><h3>{game.title}</h3><p>{game.platforms || 'PC'}{game.releaseYear ? ' · ' + game.releaseYear : ''}</p></div>
        <Link className="card-arrow" to={'/games/' + encodeURIComponent(game.slug)} aria-label={'Открыть страницу игры: ' + game.title}>
          <ArrowUpRight size={18} />
        </Link>
      </div>
      <div className="game-meta">
        <span><Gamepad2 size={14} /> {game.genre || 'Игра'}</span>
        <span className="status-dot">{STATUS_LABELS[status] || 'В библиотеке'}</span>
      </div>
    </article>
  );
}
