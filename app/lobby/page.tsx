'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const timeControlNames: Record<string, string> = {
  blitz: 'Блиц (3+0)',
  rapid: 'Быстрые (10+0)',
  classic: 'Классика (30+0)',
};

export default function LobbyPage() {
  const [games, setGames] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
  }, []);

  const fetchGames = async () => {
    console.log('Запрос игр...');
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .is('player2_id', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Ошибка загрузки:', error);
      return;
    }

    console.log('Найдено игр:', data?.length);
    if (data && data.length > 0) {
      // Расширяем данными о создателе
      const gamesWithNames = await Promise.all(
        data.map(async (game) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, elo')
            .eq('id', game.player1_id)
            .single();
          return {
            ...game,
            player1_name: profile?.username || 'Аноним',
            player1_elo: profile?.elo || 1200,
          };
        })
      );
      setGames(gamesWithNames);
    } else {
      setGames([]);
    }
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 3000);
    return () => clearInterval(interval);
  }, []);

  const createGame = async () => {
    if (!userId) {
      alert('Войдите в аккаунт');
      return;
    }

    const roomId = Math.random().toString(36).substring(2, 10);
    const { error } = await supabase.from('game_rooms').insert({
      id: roomId,
      player1_id: userId,
      status: 'waiting',
      time_control: 'rapid',
      time_left_player1: 600,
      time_left_player2: 600,
      fen: 'start',
      current_turn: 'w',
    });

    if (error) {
      console.error('Ошибка создания:', error);
      alert('Не удалось создать игру');
      return;
    }

    router.push(`/game/multiplayer?room=${roomId}`);
  };

  const joinGame = (gameId: string) => {
    router.push(`/game/multiplayer?room=${gameId}`);
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Лобби открытых игр</h1>
        <button onClick={createGame} className="bg-green-600 text-white px-4 py-2 rounded">
          Создать игру
        </button>
      </div>

      {games.length === 0 ? (
        <p>Нет открытых игр. Создайте свою!</p>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <div key={game.id} className="border p-4 rounded flex justify-between">
              <div>
                <div className="font-bold">{game.player1_name}</div>
                <div className="text-sm">Рейтинг: {game.player1_elo}</div>
                <div className="text-sm">Время: {timeControlNames[game.time_control] || game.time_control}</div>
              </div>
              <button onClick={() => joinGame(game.id)} className="bg-blue-600 text-white px-3 py-1 rounded">
                Присоединиться
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}