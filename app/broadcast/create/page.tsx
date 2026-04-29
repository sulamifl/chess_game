'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function CreateBroadcast() {
  const [name, setName] = useState('');
  const [gameRoomId, setGameRoomId] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingGames, setExistingGames] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id || null));
  }, []);

  // Загружаем активные игры пользователя для выбора
  useEffect(() => {
    if (!userId) return;
    const fetchGames = async () => {
      const { data } = await supabase
        .from('game_rooms')
        .select('id, status, player1_id, player2_id')
        .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
        .eq('status', 'playing');
      if (data) setExistingGames(data);
    };
    fetchGames();
  }, [userId]);

  const createBroadcast = async () => {
    if (!name || !gameRoomId) {
      alert('Введите название и ID комнаты');
      return;
    }
    setLoading(true);
    
    const broadcastId = Math.random().toString(36).substring(2, 10);
    
    // Проверяем, существует ли комната
    const { data: gameRoom } = await supabase
      .from('game_rooms')
      .select('id')
      .eq('id', gameRoomId)
      .single();
    
    if (!gameRoom) {
      alert('Комната не найдена. Убедитесь, что ID правильный');
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('broadcast_rooms').insert({
      id: broadcastId,
      name,
      created_by: userId,
      game_room_id: gameRoomId,
      status: 'live',
    });
    
    if (error) {
      alert('Ошибка создания трансляции: ' + error.message);
    } else {
      router.push(`/broadcast/${broadcastId}`);
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">📺 Создать трансляцию</h1>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Название трансляции"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border p-2 rounded"
        />
        
        <div>
          <label className="block text-sm mb-1">ID игровой комнаты</label>
          <input
            type="text"
            placeholder="Например: abc123"
            value={gameRoomId}
            onChange={(e) => setGameRoomId(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        {existingGames.length > 0 && (
          <div>
            <label className="block text-sm mb-1">Или выберите из ваших активных игр:</label>
            <select
              onChange={(e) => setGameRoomId(e.target.value)}
              className="w-full border p-2 rounded"
              defaultValue=""
            >
              <option value="" disabled>Выберите комнату</option>
              {existingGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.id} ({game.player1_id === userId ? 'Белые' : 'Чёрные'})
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={createBroadcast}
          disabled={loading}
          className="w-full bg-red-600 text-white py-2 rounded"
        >
          {loading ? 'Создание...' : 'Начать трансляцию'}
        </button>

        <div className="text-xs text-gray-500 text-center">
          <p>Как получить ID комнаты?</p>
          <p>При создании игры по ссылке, ID находится в URL: ?room=XXXXXX</p>
        </div>
      </div>
    </div>
  );
}