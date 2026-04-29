'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUserLocation } from '@/lib/location';

export default function ProfilePage() {
  const [profile, setProfile] = useState<{ 
    elo: number; 
    city: string; 
    country: string; 
    username: string;
    avatar_url: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Получение звания по рейтингу Эло
  const getTitleByElo = (elo: number): string => {
    if (elo >= 2500) return 'GM (Гроссмейстер)';
    if (elo >= 2400) return 'IM (Международный мастер)';
    if (elo >= 2300) return 'FM (Мастер ФИДЕ)';
    if (elo >= 2200) return 'NM (Национальный мастер)';
    if (elo >= 2000) return 'КМС (Кандидат в мастера спорта)';
    if (elo >= 1800) return '1 разряд';
    if (elo >= 1600) return '2 разряд';
    if (elo >= 1400) return '3 разряд';
    return 'Новичок';
  };

  // Определение цвета для звания
  const getTitleColor = (elo: number): string => {
    if (elo >= 2500) return 'text-purple-600';
    if (elo >= 2300) return 'text-blue-600';
    if (elo >= 2000) return 'text-green-600';
    return 'text-gray-600';
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);

      // Получаем текущие данные профиля
      let { data: existing, error } = await supabase
        .from('profiles')
        .select('username, city, country, elo, avatar_url')
        .eq('id', user.id)
        .single();

      // Если профиля нет, создаём с дефолтами
      if (error || !existing) {
        const defaultData = { 
          username: user.email?.split('@')[0] || 'Аноним',
          city: 'Неизвестный город', 
          country: 'Неизвестная страна', 
          elo: 1200,
          avatar_url: null
        };
        await supabase.from('profiles').upsert({ id: user.id, ...defaultData });
        existing = defaultData;
      }

      // Определяем местоположение, если город или страна не заданы
      let city = existing.city;
      let country = existing.country;
      let updated = false;

      if (!city || city === 'Неизвестный город' || !country || country === 'Неизвестная страна') {
        const location = await getUserLocation();
        if (location) {
          city = location.city;
          country = location.country;
          updated = true;
        }
      }

      if (updated) {
        await supabase
          .from('profiles')
          .update({ city, country })
          .eq('id', user.id);
      }

      setProfile({
        elo: existing.elo || 1200,
        city: city,
        country: country,
        username: existing.username || user.email?.split('@')[0] || 'Аноним',
        avatar_url: existing.avatar_url || null,
      });
      setLoading(false);
    };
    fetchProfile();
  }, []);

  // Загрузка аватарки
  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Ошибка загрузки: ' + uploadError.message);
      setUploading(false);
      return;
    }
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);
    
    if (updateError) {
      console.error('Update error:', updateError);
      alert('Ошибка сохранения аватарки: ' + updateError.message);
    } else {
      // Обновляем локальное состояние профиля
      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      alert('Аватарка обновлена!');
    }
    setUploading(false);
  };

  const title = profile ? getTitleByElo(profile.elo) : '';
  const titleColor = profile ? getTitleColor(profile.elo) : '';

  if (loading) return <div className="p-4 text-center">Загрузка профиля...</div>;
  if (!profile) return <div className="p-4 text-center text-red-600">Не авторизован</div>;

  return (
    <div className="container mx-auto p-4 max-w-md">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        {/* Шапка с аватаркой */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-center">
          <div className="relative inline-block">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt="Avatar" 
                className="w-28 h-28 rounded-full border-4 border-white object-cover"
              />
            ) : (
              <div className="w-28 h-28 rounded-full border-4 border-white bg-gray-300 flex items-center justify-center text-4xl">
                👤
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700">
              <input type="file" accept="image/*" onChange={uploadAvatar} disabled={uploading} className="hidden" />
              {uploading ? '⏳' : '📷'}
            </label>
          </div>
          <h1 className="text-2xl font-bold text-white mt-3">{profile.username}</h1>
          <p className={`text-lg font-semibold ${titleColor}`}>{title}</p>
        </div>

        {/* Информация */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">Рейтинг Эло</div>
            <div className="text-4xl font-bold">{profile.elo}</div>
            <div className="text-xs text-gray-400 mt-1">
              Следующее звание: {
                profile.elo < 1400 ? '3 разряд (1400)' :
                profile.elo < 1600 ? '2 разряд (1600)' :
                profile.elo < 1800 ? '1 разряд (1800)' :
                profile.elo < 2000 ? 'КМС (2000)' :
                profile.elo < 2200 ? 'NM (2200)' :
                profile.elo < 2300 ? 'FM (2300)' :
                profile.elo < 2400 ? 'IM (2400)' :
                profile.elo < 2500 ? 'GM (2500)' : 'Вы достигли максимума!'
              }
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📍</span>
              <div>
                <div className="text-sm text-gray-500">Местоположение</div>
                <div>{profile.city}, {profile.country}</div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 text-center text-sm text-gray-500">
            Рейтинг обновляется после каждой игры в мультиплеере
          </div>
        </div>
      </div>
    </div>
  );
}