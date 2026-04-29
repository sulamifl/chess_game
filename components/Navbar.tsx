'use client';

import Link from 'next/link';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import Auth from './Auth';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { href: '/game/local', label: 'Hot-seat' },
    { href: '/game/ai', label: 'Против ИИ' },
    { href: '/game/multiplayer', label: 'Мультиплеер' },
    { href: '/lobby', label: 'Лобби' },
    { href: '/watch', label: 'Трансляции' },
    { href: '/tournaments', label: 'Турниры' },
    { href: '/profile', label: 'Профиль' },
    { href: '/history', label: 'История' },
    { href: '/leaderboard', label: 'Лидерборд' },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            ♟️ GrandMaster Hub
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            {links.slice(0, 6).map(link => (
              <Link key={link.href} href={link.href} className="hover:text-blue-600 transition">
                {link.label}
              </Link>
            ))}
            <ThemeToggle />
            <Auth />
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-2xl">
            ☰
          </button>
        </div>

        {isOpen && (
          <div className="md:hidden py-4 border-t flex flex-col gap-3">
            {links.map(link => (
              <Link key={link.href} href={link.href} onClick={() => setIsOpen(false)} className="hover:text-blue-600 transition">
                {link.label}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-2">
              <ThemeToggle />
              <Auth />
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}