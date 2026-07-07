import { useState } from 'react';
import { SpellCheck } from 'lucide-react';
import { Button } from '@/design-system/components';
import {
  applyLocalWritingFixes,
  applyWritingFix,
  checkWriting,
  type WritingIssue,
} from '@/modules/inspections/lib/writing-check';

export function CommentWritingAssist({
  text,
  onApplyText,
  disabled,
}: {
  text: string;
  onApplyText: (value: string) => void;
  disabled?: boolean;
}) {
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<WritingIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function runCheck() {
    if (!text.trim()) {
      setError('Type or dictate a comment first.');
      setIssues([]);
      return;
    }

    setChecking(true);
    setError(null);
    setNotice(null);
    setIssues([]);

    try {
      const found = await checkWriting(text);
      if (found.length === 0) {
        setNotice('No spelling or grammar issues found.');
        return;
      }
      setIssues(found.slice(0, 8));
    } catch (err) {
      const locallyFixed = applyLocalWritingFixes(text);
      if (locallyFixed !== text.trim()) {
        onApplyText(locallyFixed);
        setNotice('Applied basic formatting fixes (spacing and capitals). Full grammar check needs internet.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not check writing.');
      }
    } finally {
      setChecking(false);
    }
  }

  function applyIssue(issue: WritingIssue) {
    const next = applyWritingFix(text, issue);
    onApplyText(next);
    setIssues((current) => current.filter((entry) => entry.id !== issue.id));
    setNotice('Suggestion applied.');
  }

  function applyLocalFixes() {
    const next = applyLocalWritingFixes(text);
    if (next === text.trim()) {
      setNotice('No basic fixes needed.');
      return;
    }
    onApplyText(next);
    setNotice('Applied spacing and capitalisation fixes.');
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/80 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-text-muted">
          Spelling while typing: right-click underlined words for suggestions.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || checking}
            onClick={() => applyLocalFixes()}
          >
            Quick tidy
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || checking}
            onClick={() => void runCheck()}
          >
            <SpellCheck className="h-4 w-4" aria-hidden />
            {checking ? 'Checking…' : 'Check grammar'}
          </Button>
        </div>
      </div>

      {notice ? <p className="text-xs text-success">{notice}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      {issues.length > 0 ? (
        <ul className="space-y-1.5">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded border border-primary/10 bg-primary/[0.03] px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-text">{issue.message}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">
                  Suggest: <span className="font-medium text-primary">{issue.suggestion}</span>
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => applyIssue(issue)}>
                Apply
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
