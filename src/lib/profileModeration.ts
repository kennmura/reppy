const directContactPatterns = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/,
  /\bhttps?:\/\/\S+/i,
  /\bwww\.\S+/i,
  /\b(?:instagram|insta|facebook|tiktok|snapchat|whatsapp|telegram|venmo)\b/i,
  /\b(?:at|@)\s+[a-z0-9.-]+\s+(?:dot|\.)\s+[a-z]{2,}\b/i,
  /\b(?:text|call|dm|email|message me|book through|contact me)\b/i,
];

export function scanForPublicContactInfo(values: string[]) {
  const text = values.filter(Boolean).join("\n");
  return directContactPatterns.some((pattern) => pattern.test(text));
}
