'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Broadcast {
  id: string;
  name: string;
  viewer_count: number;
  created_at: string;
  game_room_id: string;
  game_room?: {
    player1_id: string;
    player2_id: string;
  };
  players?: {
    white: string;
    black: string;
  };
}

export default function BroadcastListPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBroadcasts = async () => {
    const { data } = await supabase
      .from('broadcast_rooms')
      .select('*')
      .eq('status', 'live')
      .order('created_at', { ascending: false });

    if (data) {
      // Загружаем информацию об игроках для каждой трансляции
      const broadcastsWithPlayers = await Promise.all(
        data.map(async (broadcast) => {
          const { data: gameRoom } = await supabase
            .from('game_rooms')
            .select('player1_id, player2_id')
            .eq('id', broadcast.game_room_id)
            .single();
          
          let players = { white: 'Неизвестно', black: 'Неизвестно' };
          if (gameRoom) {
            const { data: p1 } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', gameRoom.player1_id)
              .single();
            const { data: p2 } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', gameRoom.player2_id)
              .single();
            players = { white: p1?.username || 'Белые', black: p2?.username || 'Чёрные' };
          }
          return { ...broadcast, players };
        })
      );
      setBroadcasts(broadcastsWithPlayers);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBroadcasts();
    const interval = setInterval(fetchBroadcasts, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div className="p-4 text-center">Загрузка трансляций...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">📺 Прямые эфиры</h1>
        <Link href="/broadcast/create" className="bg-red-600 text-white px-4 py-2 rounded">
          + Создать трансляцию
        </Link>
      </div>

      {broadcasts.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <p className="text-xl">Нет активных трансляций</p>
          <p className="mt-2">Станьте первым, кто начнёт эфир!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {broadcasts.map((broadcast) => (
            <Link key={broadcast.id} href={`/broadcast/${broadcast.id}`}>
              <div className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer bg-white dark:bg-gray-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                  <span className="text-xs text-red-600">LIVE</span>
                </div>
                <h2 className="text-xl font-semibold mb-2">{broadcast.name}</h2>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <div>⚪ {broadcast.players?.white} vs ⚫ {broadcast.players?.black}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span>👁️ {broadcast.viewer_count || 0} зрителей</span>
                    <span>•</span>
                    <span>{new Date(broadcast.created_at).toLocaleTimeString()}</span>
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