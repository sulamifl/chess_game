'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Chess } from 'chess.js';

interface Game {
  id: string;
  pgn: string;
  result: string;
  played_at: string;
}

export default function HistoryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false });
      if (!error && data) setGames(data);
      setLoading(false);
    };
    fetchGames();
  }, []);

  const getResultText = (result: string) => {
    if (result === '1-0') return 'Победа белых 🏆';
    if (result === '0-1') return 'Победа чёрных 🏆';
    return 'Ничья 🤝';
  };

  const getResultColor = (result: string) => {
    if (result === '1-0' || result === '0-1') return 'text-green-600';
    return 'text-gray-500';
  };

  const extractMoves = (pgn: string) => {
    // Убираем заголовки и оставляем только ходы
    const movesMatch = pgn.match(/\d+\..*/);
    if (movesMatch) return movesMatch[0];
    // Если нет ходов, показываем FEN если есть
    const fenMatch = pgn.match(/\[FEN "([^"]+)"\]/);
    if (fenMatch) return `Начальная позиция: ${fenMatch[1].substring(0, 30)}...`;
    return pgn.substring(0, 200);
  };

  if (loading) return <div className="p-4 text-center">Загрузка...</div>;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">📜 История партий</h1>
      {games.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p className="text-xl">Вы ещё не сыграли ни одной партии</p>
          <p className="mt-2">Сыграйте с ИИ или с другом, чтобы увидеть историю</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {games.map((game) => (
            <li key={game.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                <span className={`font-semibold ${getResultColor(game.result)}`}>
                  {getResultText(game.result)}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(game.played_at).toLocaleString()}
                </span>
              </div>
              
              <button
                onClick={() => setExpandedGame(expandedGame === game.id ? null : game.id)}
                className="text-blue-600 text-sm mb-2 hover:underline"
              >
                {expandedGame === game.id ? 'Скрыть PGN' : 'Показать PGN'}
              </button>
              
              {expandedGame === game.id && (
                <div className="mt-2">
                  <pre className="p-3 bg-gray-100 dark:bg-gray-700 rounded overflow-x-auto text-xs whitespace-pre-wrap">
                    {game.pgn || 'PGN не доступен'}
                  </pre>
                </div>
              )}
              
              <div className="text-xs text-gray-400 mt-2">
                {extractMoves(game.pgn)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}