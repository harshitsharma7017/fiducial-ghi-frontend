'use client';

import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { useCurrentUser } from '@/hooks/use-current-user';
import { apiFetch } from '@/lib/api-client';
import { isDemoModeError } from '@/lib/demo-mode';
import {
  ProposalListResponseSchema,
  SAMPLE_MERGE_VALUES,
  mergeValuesFor,
  parseTemplate,
  renderMail,
  type MergeValues,
  type ProposalRecord,
} from '@/shared';

const SAMPLE = 'sample';

/** Recent cases to preview a template with (one page, newest first). */
function useRecentCases() {
  return useQuery({
    queryKey: ['proposals', 'recent-for-preview'],
    queryFn: async ({ signal }) => {
      try {
        const page = await apiFetch('proposals?limit=50', {
          schema: ProposalListResponseSchema,
          signal,
        });
        return page.items;
      } catch (error) {
        if (isDemoModeError(error)) return [];
        throw error;
      }
    },
  });
}

/** The merge values a mail of this case would get: its first insurer, its due date, you as sender. */
function valuesFor(record: ProposalRecord, senderName: string): MergeValues {
  const insurer = record.insurers[0];
  return mergeValuesFor({
    record,
    insurer: insurer ?? { company: 'Insurer', branch: 'Branch' },
    contactName: insurer?.contacts[0]?.name ?? null,
    dueDate: insurer?.dueDate ?? record.dueDate,
    senderName,
  });
}

/**
 * The mail as insurers would get it, rendered with the same renderMail() as the API, from sample
 * values or a chosen case. Shows the template's problems instead while it has any.
 */
export function TemplatePreview({ subject, body }: { subject: string; body: string }) {
  const selectId = useId();
  const [choice, setChoice] = useState(SAMPLE);
  const cases = useRecentCases();
  const me = useCurrentUser();
  const record = cases.data?.find((item) => item.id === choice) ?? null;
  const values = record ? valuesFor(record, me.data?.name ?? 'You') : SAMPLE_MERGE_VALUES;

  const problems = [
    ...(parseTemplate(subject).ok ? [] : ['subject']),
    ...(parseTemplate(body).ok ? [] : ['message']),
  ];
  const mail =
    problems.length === 0 && subject.trim() && body.trim()
      ? renderMail({ subject, body }, values)
      : null;

  return (
    <section
      aria-label="Preview"
      className="grid content-start gap-3 rounded-md border bg-muted/30 p-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>Preview with</Label>
        <NativeSelect
          id={selectId}
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value={SAMPLE}>Sample values</option>
          {(cases.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.reference} · {item.client.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {mail ? (
        <div className="grid gap-2 text-sm">
          <p>
            <span className="text-xs text-muted-foreground">Subject</span>
            <span className="block font-medium break-words">{mail.subject}</span>
          </p>
          <div>
            <span className="text-xs text-muted-foreground">Message</span>
            <p className="rounded-md border bg-card p-3 break-words whitespace-pre-wrap">
              {mail.text}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {problems.length > 0
            ? `Fix the ${problems.join(' and ')} to see the preview.`
            : 'Enter a subject and a message to see the preview.'}
        </p>
      )}
    </section>
  );
}
