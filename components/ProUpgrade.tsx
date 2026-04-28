'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { addTokens } from '@/lib/tokens';

export default function ProUpgrade() {
  const [loading, setLoading] = useState(false);
  const handleUpgrade = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Войдите в аккаунт');
      return;
    }
    setLoading(true);
    // Здесь будет реальная интеграция Stripe, пока демо-начисление
    await addTokens(user.id, 10);
    alert('Начислено 10 токенов (демо-режим). В реальности здесь будет оплата.');
    setLoading(false);
  };
  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
    >
      {loading ? 'Обработка...' : '⭐ Upgrade to Pro (демо)'}
    </button>
  );
}