/**
 * Raff's identity in one place: name, developer, links, and where it comes from.
 *
 * Raff is based on Edge-Drop by Deepender25 (Apache-2.0). The translations
 * still say "Edge-Drop" — they are shared with upstream so its updates merge
 * cleanly — and brandText() swaps the name when a string is shown.
 */
export const BRAND = {
  /** Product name, as macOS shows it (menu bar, Applications, notifications). */
  name: 'Raff',
  /** The name in capitals, for small-caps labels ("ABOUT RAFF"). */
  nameUpper: 'RAFF',
  developer: 'Mohamed Hassan',
  /** GitHub "owner/repo" that hosts the source and the releases (the update feed). */
  repo: 'cdh30234/Raff',
  repoUrl: 'https://github.com/cdh30234/Raff',
  issuesUrl: 'https://github.com/cdh30234/Raff/issues/new/choose',
  releasesUrl: 'https://github.com/cdh30234/Raff/releases',
  upstream: {
    name: 'Edge-Drop',
    author: 'Deepender25',
    url: 'https://github.com/Deepender25/Edge-Drop'
  }
} as const

/** Upstream's name in a translated string -> Raff ("About Edge-Drop" -> "About Raff"). */
export function brandText(text: string): string {
  return text.replace(/Edge-Drop/g, BRAND.name).replace(/EDGE-DROP/g, BRAND.nameUpper)
}
