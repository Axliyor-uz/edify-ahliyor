/** Places for the podium: equal scores share a place (1, 1, 3…). */
export function ranking(scores: number[]): { team: number; score: number; place: number }[] {
  const sorted = scores.map((score, team) => ({ team, score })).sort((a, b) => b.score - a.score || a.team - b.team);
  return sorted.map((row) => ({ ...row, place: sorted.findIndex((r) => r.score === row.score) + 1 }));
}
