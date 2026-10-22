'use client';

import { CircleAlert, LoaderCircle, RotateCcw, Save } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { ApiError } from '@/lib/api-client';
import {
  EMAIL_BODY_MAX,
  EMAIL_SUBJECT_MAX,
  EMAIL_TEMPLATE_KIND_LABELS,
  formatDateTime,
  parseTemplate,
  type EmailTemplate,
  type MergeField,
} from '@/shared';
import { FieldProblems, MergeFieldButtons } from './template-fields';
import { TemplatePreview } from './template-preview';
import { useSaveEmailTemplate } from './use-email-templates';

type Field = 'subject' | 'body';

const PURPOSE: Record<EmailTemplate['kind'], string> = {
  RFQ: 'Sent to each insurer with the RFQ attached, one mail per insurer.',
  REMINDER: 'Sent when a user reminds an insurer that has not answered.',
  QCR: 'Sent to the insured with the approved QCR attached. {{insurerName}} is the recommended insurer.',
  PLACEMENT_SLIP:
    'Sent to the insurer the client accepted, with the approved placement slip attached. {{contactName}} is the insurer’s contact chosen, if any.',
  COVERAGE_CONFIRMATION:
    'Sent to the insured once the insurer confirms cover, optionally with the coverage confirmation letter attached. {{insurerName}} is the insurer the cover was placed with.',
};

/** Field problems: the API's on save, else the same checks as the API's, while typing. */
function problemsOf(value: string, serverError: string | undefined): string[] {
  if (serverError) return [serverError];
  const parsed = parseTemplate(value);
  return parsed.ok ? [] : parsed.errors;
}

/**
 * One email template: subject and message with merge fields inserted at the cursor, a live
 * preview, and saving with the version it was loaded at (E-2). Read-only without masters.manage.
 * Render it keyed by kind and version, so a saved or reloaded version starts afresh.
 */
export function TemplateEditor({
  template,
  canManage,
  onReload,
}: {
  template: EmailTemplate;
  canManage: boolean;
  onReload: () => void;
}) {
  const ids = { subject: useId(), body: useId() };
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [serverErrors, setServerErrors] = useState<Partial<Record<Field, string>>>({});
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<Field>('body');
  const save = useSaveEmailTemplate(template.kind);
  const label = EMAIL_TEMPLATE_KIND_LABELS[template.kind];

  const changed = subject !== template.subject || body !== template.body;
  const conflict =
    save.error instanceof ApiError && save.error.code === 'TEMPLATE_VERSION_CONFLICT';
  const subjectProblems = problemsOf(subject, serverErrors.subject);
  const bodyProblems = problemsOf(body, serverErrors.body);

  const setValue = (field: Field, value: string) => {
    if (field === 'subject') setSubject(value);
    else setBody(value);
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  };

  const insert = (merge: MergeField) => {
    const field = lastFocused.current;
    const element = field === 'subject' ? subjectRef.current : bodyRef.current;
    const value = field === 'subject' ? subject : body;
    const token = `{{${merge}}}`;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    setValue(field, value.slice(0, start) + token + value.slice(end));
    // Put the cursor after the inserted field once React has rendered the new value.
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const submit = () => {
    setServerErrors({});
    save.mutate(
      { subject, body, expectedVersion: template.version },
      {
        onSuccess: () => toast({ title: `${label} template saved`, variant: 'success' }),
        onError: (error) => {
          if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR') return;
          const issues = Array.isArray(error.details)
            ? (error.details as { path?: unknown; message?: unknown }[])
            : [];
          const next: Partial<Record<Field, string>> = {};
          for (const issue of issues) {
            if (
              (issue.path === 'subject' || issue.path === 'body') &&
              typeof issue.message === 'string'
            ) {
              next[issue.path] ??= issue.message;
            }
          }
          setServerErrors(next);
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex items-center gap-2">
            {label}
            {template.isDefault ? <Badge variant="muted">Default</Badge> : null}
          </CardTitle>
          <CardDescription>{PURPOSE[template.kind]}</CardDescription>
          <p className="text-xs text-muted-foreground tabular">
            Version {template.version}
            {template.updatedBy
              ? ` · changed ${formatDateTime(template.updatedAt)} by ${template.updatedBy}`
              : ' · as installed'}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!changed || save.isPending}
              onClick={() => {
                setSubject(template.subject);
                setBody(template.body);
                setServerErrors({});
                save.reset();
              }}
            >
              <RotateCcw aria-hidden="true" />
              Undo changes
            </Button>
            <Button
              size="sm"
              disabled={
                !changed || save.isPending || subjectProblems.length + bodyProblems.length > 0
              }
              onClick={submit}
            >
              {save.isPending ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              Save {label} template
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-4">
          {conflict ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>Someone else saved this template</AlertTitle>
              <AlertDescription className="grid gap-2">
                <span>Reload it to see their version; your changes here are not saved.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  onClick={onReload}
                >
                  Reload the template
                </Button>
              </AlertDescription>
            </Alert>
          ) : save.isError &&
            !(save.error instanceof ApiError && save.error.code === 'VALIDATION_ERROR') ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(save.error)}</AlertDescription>
            </Alert>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor={ids.subject}>Subject</Label>
            <Input
              id={ids.subject}
              ref={subjectRef}
              value={subject}
              maxLength={EMAIL_SUBJECT_MAX}
              readOnly={!canManage}
              aria-invalid={subjectProblems.length > 0 || undefined}
              aria-describedby={subjectProblems.length > 0 ? `${ids.subject}-error` : undefined}
              onFocus={() => (lastFocused.current = 'subject')}
              onChange={(event) => setValue('subject', event.target.value)}
            />
            <FieldProblems id={`${ids.subject}-error`} problems={subjectProblems} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={ids.body}>Message</Label>
            <Textarea
              id={ids.body}
              ref={bodyRef}
              value={body}
              rows={12}
              maxLength={EMAIL_BODY_MAX}
              readOnly={!canManage}
              aria-invalid={bodyProblems.length > 0 || undefined}
              aria-describedby={bodyProblems.length > 0 ? `${ids.body}-error` : undefined}
              onFocus={() => (lastFocused.current = 'body')}
              onChange={(event) => setValue('body', event.target.value)}
            />
            <FieldProblems id={`${ids.body}-error`} problems={bodyProblems} />
          </div>
          {canManage ? <MergeFieldButtons onInsert={insert} /> : null}
        </div>
        <TemplatePreview subject={subject} body={body} />
      </CardContent>
    </Card>
  );
}
