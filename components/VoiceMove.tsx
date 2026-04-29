'use client';

import { useState } from 'react';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface VoiceMoveProps {
  onMove: (from: string, to: string) => void;
  enabled: boolean;
}

export default function VoiceMove({ onMove, enabled }: VoiceMoveProps) {
  const [listening, setListening] = useState(false);

  const startListening = () => {
    if (!enabled) return;
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      alert('Голосовое управление не поддерживается в этом браузере');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript.toLowerCase();
      const match = text.match(/([a-h][1-8])\s*([a-h][1-8])/);
      if (match) {
        onMove(match[1], match[2]);
      } else {
        alert('Не удалось распознать ход. Скажите, например, "e2 e4"');
      }
    };
    recognition.start();
  };

  return (
    <button
      onClick={startListening}
      disabled={!enabled || listening}
      className={`px-3 py-1 rounded ${listening ? 'bg-red-500' : 'bg-purple-600'} text-white`}
    >
      {listening ? '🎤 Слушаю...' : '🎤 Ход голосом'}
    </button>
  );
}