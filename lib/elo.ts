export function calculateElo(
    winnerElo: number,
    loserElo: number,
    k: number = 32
  ): { newWinnerElo: number; newLoserElo: number } {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 - expectedWinner;
    
    const newWinnerElo = Math.round(winnerElo + k * (1 - expectedWinner));
    const newLoserElo = Math.round(loserElo + k * (0 - expectedLoser));
    
    return { newWinnerElo, newLoserElo };
  }
  
  export function calculateEloForDraw(
    player1Elo: number,
    player2Elo: number,
    k: number = 32
  ): { newPlayer1Elo: number; newPlayer2Elo: number } {
    const expected1 = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400));
    const expected2 = 1 - expected1;
    
    const newPlayer1Elo = Math.round(player1Elo + k * (0.5 - expected1));
    const newPlayer2Elo = Math.round(player2Elo + k * (0.5 - expected2));
    
    return { newPlayer1Elo, newPlayer2Elo };
  }