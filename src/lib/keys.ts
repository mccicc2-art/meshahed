// Shared pure helpers safe to import from both server and client components.
export function episodeKey(season: number, episode: number) {
  return `${season}:${episode}`;
}
