'use client';

import Link from 'next/link';
import Auth from '@/components/Auth';
import ThemeToggle from '@/components/ThemeToggle';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        {/* Убираем дублирование – оставляем только карточки */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto mt-8">
          <Link href="/game/local" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🎮</div>
            <h2 className="text-xl font-bold mb-2">Игра вдвоём</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Hot-seat режим на одном устройстве</p>
          </Link>

          <Link href="/game/ai" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🤖</div>
            <h2 className="text-xl font-bold mb-2">Против ИИ</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Настраиваемая сложность (1-20)</p>
          </Link>

          <Link href="/game/multiplayer" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🌐</div>
            <h2 className="text-xl font-bold mb-2">Мультиплеер</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Игра с другом по ссылке</p>
          </Link>

          <Link href="/lobby" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🎯</div>
            <h2 className="text-xl font-bold mb-2">Лобби</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Открытые игры других игроков</p>
          </Link>

          <Link href="/watch" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">📺</div>
            <h2 className="text-xl font-bold mb-2">Трансляции</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Смотрите игры в реальном времени</p>
          </Link>

          <Link href="/tournament/tournaments" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🏆</div>
            <h2 className="text-xl font-bold mb-2">Турниры</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Создавайте и участвуйте</p>
          </Link>

          <Link href="/profile" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">👤</div>
            <h2 className="text-xl font-bold mb-2">Профиль</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Ваш рейтинг и звания</p>
          </Link>

          <Link href="/history" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">📜</div>
            <h2 className="text-xl font-bold mb-2">История</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Все сыгранные партии</p>
          </Link>

          <Link href="/leaderboard" className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition transform hover:-translate-y-1">
            <div className="text-4xl mb-3">🏅</div>
            <h2 className="text-xl font-bold mb-2">Лидерборд</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">Рейтинг по странам</p>
          </Link>
        </div>
      </div>
    </div>
  );
}