'use client';

import { useQuery } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { CompanyFilter } from '@/components/claims/claim-ui';
import { ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  claimHrContactQuery,
  claimTemplatesQuery,
  issuesText,
  useClaimMutation,
} from '@/lib/api/claims';
import {
  CLAIM_EMAIL_AUDIENCE_LABELS,
  CLAIM_MERGE_FIELDS,
  CLAIM_MERGE_FIELD_LABELS,
  CLAIM_STATUS_LABELS,
  ClaimEmailTemplateSchema,
  ClaimHrContactSchema,
  SAMPLE_CLAIM_MERGE_VALUES,
  formatDateTime,
  parseClaimTemplate,
  renderClaimMail,
  type ClaimEmailTemplate,
  type ClaimHrContact,
} from '@/shared';

/** The claim emails (one per status moved into, for the claimant and for HR) and HR contacts (C3). */
export function ClaimSettings() {
  const templates = useQuery(claimTemplatesQuery());
  const [selected, setSelected] = useState(0);
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Claim emails</CardTitle>
          <CardDescription>
            Sent at each move to the claimant and, when switched on below, the company’s HR. Merge
            fields fill in from the claim.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.isPending ? (
            <LoadingState label="Loading templates" />
          ) : templates.isError ? (
            <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
              <ul className="grid content-start gap-1" aria-label="Templates">
                {templates.data.items.map((template, index) => (
                  <li key={`${template.status}-${template.audience}`}>
                    <button
                      type="button"
                      aria-pressed={selected === index}
                      onClick={() => setSelected(index)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? 'border-primary bg-primary-soft/40' : 'hover:bg-muted'}`}
                    >
                      <span className="block font-medium">
                        Moved to {CLAIM_STATUS_LABELS[template.status]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        To the {CLAIM_EMAIL_AUDIENCE_LABELS[template.audience].toLowerCase()}
                        {template.isDefault ? ' · default wording' : ` · v${template.version}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {templates.data.items[selected] ? (
                <TemplateEditor
                  key={`${selected}-${templates.data.items[selected].version}`}
                  template={templates.data.items[selected]}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
      <HrContacts />
    </div>
  );
}

function TemplateEditor({ template }: { template: ClaimEmailTemplate }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const save = useClaimMutation(
    () =>
      apiFetch(`claims/email-templates/${template.status}/${template.audience}`, {
        method: 'PUT',
        body: { subject, body, expectedVersion: template.version },
        schema: ClaimEmailTemplateSchema,
      }),
    () => ({ title: 'Template saved' }),
  );
  const problems = [parseClaimTemplate(subject), parseClaimTemplate(body)].flatMap((parsed) =>
    parsed.ok ? [] : parsed.errors,
  );
  const preview =
    problems.length === 0
      ? renderClaimMail(
          { subject, body },
          { ...SAMPLE_CLAIM_MERGE_VALUES, status: CLAIM_STATUS_LABELS[template.status] },
        )
      : null;
  const insert = (field: string) => {
    const element = bodyRef.current;
    const at = element?.selectionStart ?? body.length;
    setBody(`${body.slice(0, at)}{{${field}}}${body.slice(element?.selectionEnd ?? at)}`);
  };
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {template.updatedBy
          ? `Last saved by ${template.updatedBy}, ${formatDateTime(template.updatedAt)}`
          : 'The wording installed with the app.'}
      </p>
      <Label className="grid gap-1 text-sm font-normal">
        Subject
        <Input
          value={subject}
          maxLength={200}
          onChange={(event) => setSubject(event.target.value)}
        />
      </Label>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Insert a merge field">
        {CLAIM_MERGE_FIELDS.map((field) => (
          <Button
            key={field}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => insert(field)}
            title={CLAIM_MERGE_FIELD_LABELS[field]}
          >
            {`{{${field}}}`}
          </Button>
        ))}
      </div>
      <Label className="grid gap-1 text-sm font-normal">
        Message
        <Textarea
          ref={bodyRef}
          rows={10}
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </Label>
      {problems.length > 0 ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{problems.join(' ')}</AlertDescription>
        </Alert>
      ) : null}
      {preview ? (
        <div className="grid gap-1 rounded-md border bg-muted/40 p-3 text-sm">
          <span className="text-xs text-muted-foreground">Preview with sample values</span>
          <span className="font-medium">{preview.subject}</span>
          <span className="whitespace-pre-wrap">{preview.text}</span>
        </div>
      ) : null}
      {save.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{issuesText(save.error) ?? errorMessage(save.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex justify-end">
        <Button
          type="button"
          disabled={save.isPending || problems.length > 0}
          onClick={() => save.mutate(undefined)}
        >
          {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          Save template
        </Button>
      </div>
    </div>
  );
}

function HrContacts() {
  const [clientId, setClientId] = useState('');
  const contact = useQuery(claimHrContactQuery(clientId));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Company HR contacts</CardTitle>
        <CardDescription>
          HR is emailed at each move only when switched on and an address is set.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <CompanyFilter value={clientId} onChange={setClientId} />
        {!clientId ? null : contact.isPending ? (
          <LoadingState label="Loading the HR contact" />
        ) : contact.isError ? (
          <ErrorState error={contact.error} onRetry={() => void contact.refetch()} />
        ) : (
          <HrForm
            key={`${contact.data.clientId}-${contact.data.updatedAt ?? ''}`}
            contact={contact.data}
          />
        )}
      </CardContent>
    </Card>
  );
}

function HrForm({ contact }: { contact: ClaimHrContact }) {
  const [name, setName] = useState(contact.name ?? '');
  const [email, setEmail] = useState(contact.email ?? '');
  const [notify, setNotify] = useState(contact.notify);
  const save = useClaimMutation(
    () =>
      apiFetch(`claims/hr-contacts/${contact.clientId}`, {
        method: 'PUT',
        body: { name, email, notify },
        schema: ClaimHrContactSchema,
      }),
    () => ({ title: 'HR contact saved' }),
  );
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(undefined);
      }}
    >
      <Label className="grid gap-1 text-sm font-normal">
        HR name
        <Input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
      </Label>
      <Label className="grid gap-1 text-sm font-normal">
        HR email
        <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Label>
      <Label className="flex items-center gap-2 text-sm font-normal sm:col-span-2">
        <Checkbox checked={notify} onCheckedChange={(checked) => setNotify(checked === true)} />
        Email HR at each claim status change
        {contact.notify ? <Badge variant="success">On</Badge> : <Badge variant="muted">Off</Badge>}
      </Label>
      {save.isError ? (
        <Alert variant="destructive" role="alert" className="sm:col-span-2">
          <AlertDescription>{issuesText(save.error) ?? errorMessage(save.error)}</AlertDescription>
        </Alert>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={save.isPending}>
          Save HR contact
        </Button>
      </div>
    </form>
  );
}
