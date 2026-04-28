import { supabase } from './supabase';
import { calculateElo, calculateEloForDraw } from './elo';

export async function saveGame(userId: string, pgn: string, result: string) {
  const { error } = await supabase.from('games').insert({ user_id: userId, pgn, result });
  if (error) console.error('Ошибка сохранения партии:', error);
}

export async function updateRatings(
  winnerId: string,
  loserId: string,
  isDraw: boolean = false
): Promise<boolean> {
  // Получаем текущие рейтинги
  const { data: players, error } = await supabase
    .from('profiles')
    .select('id, elo')
    .in('id', [winnerId, loserId]);
  if (error || !players || players.length !== 2) return false;

  const player1 = players.find(p => p.id === winnerId);
  const player2 = players.find(p => p.id === loserId);
  if (!player1 || !player2) return false;

  let newElo1: number, newElo2: number;
  if (isDraw) {
    const result = calculateEloForDraw(player1.elo, player2.elo);
    newElo1 = result.newPlayer1Elo;
    newElo2 = result.newPlayer2Elo;
  } else {
    const result = calculateElo(player1.elo, player2.elo);
    newElo1 = result.newWinnerElo;
    newElo2 = result.newLoserElo;
  }

  // Обновляем рейтинги
  const { error: updateError1 } = await supabase
    .from('profiles')
    .update({ elo: newElo1 })
    .eq('id', winnerId);
  const { error: updateError2 } = await supabase
    .from('profiles')
    .update({ elo: newElo2 })
    .eq('id', loserId);

  return !(updateError1 || updateError2);
}