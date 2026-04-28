'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface LeaderboardEntry {
  username: string;
  city: string;
  country: string;
  elo: number;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, city, country, elo')
        .order('elo', { ascending: false });
      if (!error && data) setLeaders(data);
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  if (loading) return <div className="p-4">Загрузка...</div>;

  // Группировка по странам
  const grouped = leaders.reduce<Record<string, LeaderboardEntry[]>>((acc, user) => {
    const country = user.country || 'Неизвестно';
    if (!acc[country]) acc[country] = [];
    acc[country].push(user);
    return acc;
  }, {});

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">🏆 Лидерборд по странам (рейтинг Эло)</h1>
      {Object.entries(grouped).map(([country, users]) => (
        <div key={country} className="mb-8">
          <h2 className="text-2xl font-semibold mb-3">{country}</h2>
          <ul className="space-y-2">
            {users.map((user, idx) => (
              <li key={idx} className="border rounded p-3 flex justify-between items-center">
                <div>
                  <span className="font-medium">{user.username}</span>
                  <span className="text-sm text-gray-500 ml-2">{user.city}</span>
                </div>
                <span className="text-lg font-bold">{user.elo} 📊</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {leaders.length === 0 && <p>Нет данных. Сыграйте несколько партий в мультиплеере.</p>}
    </div>
  );
}