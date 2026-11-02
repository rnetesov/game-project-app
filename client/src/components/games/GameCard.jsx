import { ArrowUpRight, Clock3 } from 'lucide-react';

export default function GameCard({ game }) {
  return (
    <article className="game-card">
      <div className="game-cover" style={{ background: game.background }}>
        <span className="cover-label">{game.category}</span>
        <div className="cover-art">{game.symbol}</div>
      </div>
      <div className="game-info">
        <div><h3>{game.title}</h3><p>{game.subtitle}</p></div>
        <button className="card-arrow" aria-label={`Подробнее: ${game.title}`}><ArrowUpRight size={18} /></button>
      </div>
      <div className="game-meta"><span><Clock3 size={14} /> {game.hours} ч. в игре</span><span className="status-dot">В библиотеке</span></div>
    </article>
  );
}
