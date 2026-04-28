'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserLocation } from '@/lib/location';

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ elo: number; city: string; country: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Получаем текущие данные профиля
      let { data: existing, error } = await supabase
        .from('profiles')
        .select('city, country, elo')
        .eq('id', user.id)
        .single();

      // Если профиля нет (например, только что зарегистрировался), создаём с дефолтами
      if (error || !existing) {
        const defaultData = { city: 'Неизвестный город', country: 'Неизвестная страна', elo: 1200 };
        await supabase.from('profiles').upsert({ id: user.id, ...defaultData });
        existing = defaultData;
      }

      // Определяем местоположение, если город или страна не заданы или равны "Неизвестный..."
      const needLocation = !existing.city || existing.city === 'Неизвестный город' || 
                           !existing.country || existing.country === 'Неизвестная страна';
      
      let city = existing.city;
      let country = existing.country;

      if (needLocation) {
        const location = await getUserLocation();
        if (location) {
          city = location.city;
          country = location.country;
          // Сохраняем в БД
          await supabase
            .from('profiles')
            .update({ city, country })
            .eq('id', user.id);
        }
      }

      setProfile({
        elo: existing.elo || 1200,
        city: city,
        country: country,
      });
      setLoading(false);
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="p-4">Загрузка...</div>;
  if (!profile) return <div className="p-4">Не авторизован</div>;

  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-2xl font-bold mb-4">Мой профиль</h1>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">🏆 Рейтинг Эло</label>
          <div className="text-3xl font-bold">{profile.elo}</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">📍 Город</label>
          <div>{profile.city}</div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">🌍 Страна</label>
          <div>{profile.country}</div>
        </div>
      </div>
    </div>
  );
}