export interface WritingIssue {
  id: string;
  offset: number;
  length: number;
  message: string;
  suggestion: string;
  context: string;
}

interface LanguageToolMatch {
  offset: number;
  length: number;
  message: string;
  replacements: Array<{ value: string }>;
  context?: { text?: string };
}

export async function checkWriting(text: string): Promise<WritingIssue[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const body = new URLSearchParams({
    text: trimmed,
    language: 'en-AU',
    enabledOnly: 'false',
  });

  const response = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error('Could not reach the grammar check service. Check your internet connection.');
  }

  const data = (await response.json()) as { matches?: LanguageToolMatch[] };
  const matches = data.matches ?? [];

  return matches
    .filter((match) => match.replacements?.[0]?.value)
    .map((match, index) => ({
      id: `${match.offset}-${match.length}-${index}`,
      offset: match.offset,
      length: match.length,
      message: match.message,
      suggestion: match.replacements[0]!.value,
      context: match.context?.text?.trim() ?? trimmed.slice(match.offset, match.offset + match.length),
    }));
}

export function applyWritingFix(text: string, issue: WritingIssue): string {
  return `${text.slice(0, issue.offset)}${issue.suggestion}${text.slice(issue.offset + issue.length)}`;
}

/** Apply local fixes that do not need an internet connection. */
export function applyLocalWritingFixes(text: string): string {
  return text
    .replace(/\s{2,}/g, ' ')
    .replace(/([.!?])\s*([a-z])/g, (_, end, letter) => `${end} ${letter.toUpperCase()}`)
    .replace(/^\s*([a-z])/, (_, letter) => letter.toUpperCase())
    .trim();
}
