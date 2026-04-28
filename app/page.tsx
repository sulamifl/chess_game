import Link from 'next/link';
import Auth from '@/components/Auth';
import ProUpgrade from '@/components/ProUpgrade';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="absolute top-4 right-4 flex gap-2">
        <Auth />
      </div>
      <h1 className="text-4xl font-bold mb-8">Грандмастер Хакатон</h1>
      <div className="flex flex-col gap-4">
        <Link href="/game/local" className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded text-center">
          🎮 Игра вдвоём (Hot Seat)
        </Link>
        <Link href="/game/ai" className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded text-center">
          🤖 Игра против ИИ
        </Link>
        <Link href="/game/multiplayer" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded text-center">
          🌐 Мультиплеер по ссылке
        </Link>
        <Link href="/history" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded text-center">
          📜 История игр
        </Link>
        <Link href="/leaderboard" className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded text-center">
          🏆 Лидерборд
        </Link>
        <Link href="/profile" className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded text-center">
          👤 Мой профиль
        </Link>
        <div className="flex justify-center">
          <ProUpgrade />
        </div>
      </div>
    </main>
  );
}