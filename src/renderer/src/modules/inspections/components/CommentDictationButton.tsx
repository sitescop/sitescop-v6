import { DictationControls } from '@/modules/dictation/DictationControls';

/** Comment-field dictation — thin wrapper around the shared dictation UI. */
export function CommentDictationButton({
  disabled,
  sectionId,
  onTranscript,
}: {
  disabled?: boolean;
  sectionId?: string;
  onTranscript: (text: string) => void;
}) {
  const hint = sectionId
    ? 'Speak what you see in this section. Edit the comment after stopping if needed.'
    : 'Speak your comment, then tap Stop.';

  return <DictationControls disabled={disabled} onText={onTranscript} hint={hint} />;
}
