'use client';

import { Chessboard } from 'react-chessboard';

interface ChessboardComponentProps {
  position: string;
  onPieceDrop: (source: string, target: string) => boolean;
  arePiecesDraggable?: boolean;
  boardWidth?: number;
}

export default function ChessboardComponent({
  position,
  onPieceDrop,
  arePiecesDraggable = true,
  boardWidth = 560,
}: ChessboardComponentProps) {
  return (
    <Chessboard
      position={position}
      onPieceDrop={onPieceDrop}
      boardWidth={boardWidth}
      arePiecesDraggable={arePiecesDraggable}
    />
  );
}