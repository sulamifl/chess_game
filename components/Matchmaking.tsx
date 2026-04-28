'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const timeControls = {
  blitz: { name: 'Блиц (3+0)', seconds: 3 * 60, eloRange: 100 },
  rapid: { name: 'Быстрые (10+0)', seconds: 10 * 60, eloRange: 150 },
  classic: { name: 'Классика (30+0)', seconds: 30 * 60, eloRange: 200 },
};

export default function Matchmaking() {
  const [timeControl, setTimeControl] = useState<'blitz' | 'rapid' | 'classic'>('rapid');
  const [searching, setSearching] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!searching || !userId) return;

    // Подписка на изменения в очереди
    const channel = supabase
      .channel('matchmaking')
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'matchmaking_queue',
          event: 'INSERT',
        },
        async (payload) => {
          const newEntry = payload.new;
          if (newEntry.user_id === userId) return;

          // Проверяем, подходит ли соперник
          const { data: myProfile } = await supabase
            .from('profiles')
            .select('elo')
            .eq('id', userId)
            .single();
          const myElo = myProfile?.elo || 1200;
          const diff = Math.abs(newEntry.elo - myElo);
          const range = timeControls[timeControl].eloRange;

          if (diff <= range && newEntry.time_control === timeControl) {
            // Нашли соперника! Создаём комнату
            const roomId = Math.random().toString(36).substring(2, 10);
            const timeSeconds = timeControls[timeControl].seconds;

            await supabase.from('game_rooms').insert({
              id: roomId,
              player1_id: userId,
              player2_id: newEntry.user_id,
              fen: 'start',
              current_turn: 'w',
              status: 'playing',
              time_control: timeControl,
              time_left_player1: timeSeconds,
              time_left_player2: timeSeconds,
            });

            // Удаляем обоих из очереди
            await supabase.from('matchmaking_queue').delete().eq('user_id', userId);
            await supabase.from('matchmaking_queue').delete().eq('user_id', newEntry.user_id);

            setSearching(false);
            router.push(`/game/multiplayer?room=${roomId}`);
          }
        }
      )
      .subscribe();

    // Также подписываемся на удаление (если нас удалили, значит, соперник создал комнату)
    const deleteChannel = supabase
      .channel('matchmaking-delete')
      .on(
        'postgres_changes',
        {
          schema: 'public',
          table: 'matchmaking_queue',
          event: 'DELETE',
        },
        async (payload) => {
          if (payload.old.user_id === userId) {
            // Нас удалили – ищем комнату
            const { data: room } = await supabase
              .from('game_rooms')
              .select('id')
              .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
              .eq('status', 'playing')
              .maybeSingle();
            if (room) {
              setSearching(false);
              router.push(`/game/multiplayer?room=${room.id}`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      deleteChannel.unsubscribe();
    };
  }, [searching, userId, timeControl, router]);

  const startSearch = async () => {
    if (!userId) {
      alert('Войдите в аккаунт');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('elo')
      .eq('id', userId)
      .single();
    const elo = profile?.elo || 1200;

    // Удаляем старую запись и добавляем новую
    await supabase.from('matchmaking_queue').delete().eq('user_id', userId);
    await supabase.from('matchmaking_queue').insert({
      user_id: userId,
      time_control: timeControl,
      elo: elo,
    });

    setSearching(true);
  };

  const cancelSearch = async () => {
    if (userId) {
      await supabase.from('matchmaking_queue').delete().eq('user_id', userId);
    }
    setSearching(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 border rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4">🔍 Поиск соперника</h2>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">Контроль времени</label>
        <div className="flex gap-2">
          {Object.entries(timeControls).map(([key, control]) => (
            <button
              key={key}
              onClick={() => setTimeControl(key as any)}
              className={`flex-1 py-2 px-3 rounded ${
                timeControl === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              {control.name}
            </button>
          ))}
        </div>
      </div>
      {!searching ? (
        <button
          onClick={startSearch}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded"
        >
          Найти соперника
        </button>
      ) : (
        <div>
          <div className="text-center mb-3">
            <p>⏳ Ищем соперника...</p>
            <p className="text-sm text-gray-500">ELO: ±{timeControls[timeControl].eloRange}</p>
          </div>
          <button
            onClick={cancelSearch}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded"
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}