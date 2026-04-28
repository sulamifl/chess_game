'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Game {
  id: string;
  pgn: string;
  result: string;
  played_at: string;
}

export default function HistoryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">📜 История партий</h1>
      {games.length === 0 ? (
        <p>Вы ещё не сыграли ни одной партии. Сыграйте с ИИ или вдвоём!</p>
      ) : (
        <ul className="space-y-4">
          {games.map((game) => (
            <li key={game.id} className="border rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">
                  Результат:{' '}
                  {game.result === '1-0' && 'Победа белых'}
                  {game.result === '0-1' && 'Победа чёрных'}
                  {game.result === '1/2-1/2' && 'Ничья'}
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(game.played_at).toLocaleString()}
                </span>
              </div>
              <details>
                <summary className="cursor-pointer text-blue-600">Показать PGN</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded overflow-x-auto text-xs">
                  {game.pgn}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}