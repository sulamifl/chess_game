'use client';

import { useEffect, useState } from 'react';
import { Chessboard } from 'react-chessboard';

interface ChessboardComponentProps {
  position: string;
  onPieceDrop: (source: string, target: string) => boolean;
  arePiecesDraggable?: boolean;
}

export default function ChessboardComponent({
  position,
  onPieceDrop,
  arePiecesDraggable = true,
}: ChessboardComponentProps) {
  const [boardWidth, setBoardWidth] = useState(560);

  useEffect(() => {
    const updateWidth = () => {
      const container = document.getElementById('chessboard-container');
      if (container) {
        const maxWidth = Math.min(container.clientWidth, 560);
        setBoardWidth(maxWidth);
      } else {
        // Если контейнера нет, подстраиваемся под ширину окна
        setBoardWidth(Math.min(window.innerWidth - 32, 560));
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div id="chessboard-container" className="w-full flex justify-center">
      <Chessboard
        position={position}
        onPieceDrop={onPieceDrop}
        boardWidth={boardWidth}
        arePiecesDraggable={arePiecesDraggable}
      />
    </div>
  );
}