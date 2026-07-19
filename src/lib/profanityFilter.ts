export const DEFAULT_WORDS = [
  "shit", "shitting", "shitted",
  "fuck", "fucking", "fucked", "fucker", "fucks",
  "cunt", "cunts",
  "pussy", "pussies",
  "faggot", "faggots", "fag",
  "masturbate", "masturbating", "masturbation",
  "prostitute", "prostitutes",
  "penis", "penises",
  "vagina", "vaginas",
  "testicles", "testicle",
  "cum", "cumming",
  "ass", "asses", "asshole", "assholes",
  "bitch", "bitches",
  "cock", "cocks",
  "dick", "dicks",
  "whore", "whores",
  "bastard", "bastards",
  "motherfucker", "motherfuckers",
  "nigger", "niggers",
  "slut", "sluts",
  "prick", "pricks",
  "wanker", "wankers",
  "twat", "twats",
];

function buildRegex(words: string[]): RegExp {
  if (!words.length) return /(?!)/g; // matches nothing
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
}

export function filterProfanity(text: string, customWords?: string[]): string {
  const words = customWords && customWords.length > 0 ? customWords : DEFAULT_WORDS;
  return text.replace(buildRegex(words), (match) => "*".repeat(match.length));
}

export function containsProfanity(text: string, customWords?: string[]): boolean {
  const words = customWords && customWords.length > 0 ? customWords : DEFAULT_WORDS;
  return buildRegex(words).test(text);
}
