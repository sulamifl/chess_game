'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Tournament {
  id: string;
  name: string;
  status: string;
  max_players: number;
  current_players: number;
  time_control: string;
  created_at: string;
}

export default function TournamentsList() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTournaments();
    const interval = setInterval(fetchTournaments, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchTournaments = async () => {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTournaments(data);
    setLoading(false);
  };

  const timeControlNames: Record<string, string> = {
    blitz: 'Блиц (3+0)',
    rapid: 'Быстрые (10+0)',
    classic: 'Классика (30+0)',
  };

  if (loading) return <div className="p-4">Загрузка...</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">🏆 Турниры</h1>
        <Link href="/tournament/create" className="bg-green-600 text-white px-4 py-2 rounded">
          + Создать турнир
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <p>Нет турниров. Создайте первый!</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournament/${t.id}`}>
              <div className="border rounded-lg p-4 hover:shadow-lg transition cursor-pointer">
                <h2 className="text-xl font-semibold mb-2">{t.name}</h2>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Статус: {t.status === 'waiting' ? '🟢 Ожидание' : t.status === 'active' ? '🔴 Идёт' : '⚫ Завершён'}</p>
                  <p>Игроков: {t.current_players}/{t.max_players}</p>
                  <p>Контроль: {timeControlNames[t.time_control] || t.time_control}</p>
                  <p>Создан: {new Date(t.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}