'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function WatchListPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchGames = async () => {
    try {
      // Получаем все активные игры (со статусом 'playing' или 'waiting')
      const { data: rooms, error: roomsError } = await supabase
        .from('game_rooms')
        .select('*')
        .in('status', ['playing', 'waiting'])
        .order('created_at', { ascending: false });
      
      if (roomsError) {
        console.error('Ошибка загрузки комнат:', roomsError);
        setError(roomsError.message);
        setLoading(false);
        return;
      }
      
      if (!rooms || rooms.length === 0) {
        setGames([]);
        setLoading(false);
        return;
      }
      
      console.log('Найдено комнат:', rooms.length);
      
      // Для каждой комнаты получаем имена игроков
      const gamesWithNames = await Promise.all(
        rooms.map(async (room) => {
          let whiteName = 'Игрок 1';
          let blackName = 'Игрок 2';
          
          if (room.player1_id) {
            const { data: p1 } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', room.player1_id)
              .single();
            if (p1) whiteName = p1.username;
          }
          
          if (room.player2_id) {
            const { data: p2 } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', room.player2_id)
              .single();
            if (p2) blackName = p2.username;
          } else {
            blackName = 'Ожидание игрока...';
          }
          
          return {
            id: room.id,
            whiteName,
            blackName,
            status: room.status,
            fen: room.fen,
          };
        })
      );
      
      // Фильтруем: показываем только игры, где есть второй игрок (или ожидание)
      const activeGames = gamesWithNames.filter(g => g.status === 'playing' || (g.status === 'waiting' && g.blackName !== 'Ожидание игрока...'));
      setGames(activeGames);
    } catch (err) {
      console.error('Ошибка:', err);
      setError('Не удалось загрузить список игр');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4 text-center">Загрузка трансляций...</div>;
  if (error) return <div className="p-4 text-center text-red-600">Ошибка: {error}</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">🎥 Прямые трансляции</h1>
      
      {games.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">Нет активных игр для просмотра</p>
          <p className="text-sm text-gray-400 mt-2">Создайте игру в мультиплеере, и она появится здесь</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link key={game.id} href={`/watch/${game.id}`}>
              <div className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${game.status === 'playing' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`}></span>
                  <span className="text-xs text-gray-500">{game.status === 'playing' ? 'LIVE' : 'Ожидание'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold">⚪ {game.whiteName}</span>
                    <span className="mx-2">vs</span>
                    <span className="font-bold">⚫ {game.blackName}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {game.fen !== 'start' ? '🎬 Идёт' : '🕐 Начало...'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}