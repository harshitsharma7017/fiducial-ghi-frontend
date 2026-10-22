'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { ghiKeys } from '@/lib/api/ghi';
import { addDays, policyYearEnd, todayIst } from '@/lib/dates';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { cn } from '@/lib/utils';
import {
  ClientListResponseSchema,
  CreateGhiCaseRequestSchema,
  GHI_CASE_TYPE_LABELS,
  EbCaseCreatedSchema,
  GhiCaseRecordSchema,
  ProposalOwnersResponseSchema,
  ebCasePath,
  type EbProduct,
  type Client,
  type CreateGhiCaseFormValues,
  type CreateGhiCaseRequest,
  type GhiCaseType,
} from '@/shared';

const Schema = CreateGhiCaseRequestSchema.safeExtend({
  clientId: z.string().regex(/^[a-f0-9]{24}$/i, 'Choose the company'),
});

const TYPES: Array<{ value: GhiCaseType; hint: string }> = [
  { value: 'NEW', hint: 'The group has no policy with us yet.' },
  { value: 'RENEWAL', hint: 'The group’s expiring policy is renewed; give its insurer.' },
];

/**
 * Creates a case of an Employee Benefits product (G1, Requirement 1.4): new business or renewal,
 * the company, period and staff. GMC posts to /ghi as before; GPA and GTLI to /eb/cases.
 */
export function NewGhiCaseForm({ product = 'GMC' }: { product?: EbProduct }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useCurrentUser();
  const [client, setClient] = useState<Client | null>(null);
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<CreateGhiCaseFormValues, unknown, CreateGhiCaseRequest>({
    resolver: zodResolver(Schema),
    defaultValues: {
      type: 'NEW',
      clientId: '',
      ownerId: undefined,
      policyStart: '',
      policyEnd: '',
      dueDate: addDays(todayIst(), 7),
      existingInsurer: '',
      existingPolicyNumber: '',
    },
  });
  const type = useWatch({ control: form.control, name: 'type' }) ?? 'NEW';
  useEffect(() => {
    if (me.data && !form.getValues('ownerId')) form.setValue('ownerId', me.data.id);
  }, [me.data, form]);
  const owners = useQuery({
    queryKey: ['proposals', 'owners'],
    queryFn: ({ signal }) =>
      apiFetch('proposals/owners', { schema: ProposalOwnersResponseSchema, signal }),
  });
  const create = useMutation({
    mutationFn: (body: CreateGhiCaseRequest) =>
      product === 'GMC'
        ? apiFetch('ghi/cases', { method: 'POST', body, schema: GhiCaseRecordSchema })
        : apiFetch('eb/cases', {
            method: 'POST',
            body: { ...body, product },
            schema: EbCaseCreatedSchema,
          }),
    onSuccess: (record) => {
      void queryClient.invalidateQueries({ queryKey: ghiKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['eb'] });
      toast({
        title: `${product === 'GMC' ? 'Group health' : product} case created`,
        description: record.reference,
        variant: 'success',
      });
      router.push(ebCasePath(product, record.id));
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError)) setGeneralError(error);
    },
  });

  return (
    <Form {...form}>
      <form
        noValidate
        className="grid max-w-3xl gap-6"
        onSubmit={(event) =>
          void form.handleSubmit((values) => {
            setGeneralError(null);
            create.mutate(values);
          })(event)
        }
      >
        <Card>
          <CardHeader>
            <CardTitle>Type of case</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset className="grid gap-2 sm:grid-cols-2">
              <legend className="sr-only">Type of case</legend>
              {TYPES.map((choice) => {
                const checked = type === choice.value;
                return (
                  <label
                    key={choice.value}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2',
                      checked && 'border-primary bg-primary-soft/40',
                    )}
                  >
                    <input
                      type="radio"
                      name="type"
                      checked={checked}
                      onChange={() => form.setValue('type', choice.value)}
                      className="mt-1 accent-[var(--primary)]"
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">
                        {GHI_CASE_TYPE_LABELS[choice.value]}
                      </span>
                      <span className="text-xs text-muted-foreground">{choice.hint}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>
              The employer from the client master. Its address and GSTIN go on the RFQ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="clientId"
              render={() => (
                <FormItem>
                  {client ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
                      <div className="grid gap-0.5">
                        <span className="text-sm font-medium">{client.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {client.gstin ?? 'No GSTIN'} · {client.address.city},{' '}
                          {client.address.state}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setClient(null);
                          form.setValue('clientId', '');
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <ClientSearch
                      onChoose={(chosen) => {
                        setClient(chosen);
                        form.setValue('clientId', chosen.id, {
                          shouldValidate: form.formState.isSubmitted,
                        });
                      }}
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy period and team</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(['policyStart', 'policyEnd'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Policy period {name === 'policyStart' ? 'from' : 'to'}
                      {type === 'RENEWAL' ? '' : ' (optional)'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={field.value ?? ''}
                        onChange={(event) => {
                          field.onChange(event.target.value);
                          if (
                            name === 'policyStart' &&
                            event.target.value &&
                            !form.getFieldState('policyEnd').isDirty
                          ) {
                            form.setValue('policyEnd', policyYearEnd(event.target.value));
                          }
                        }}
                      />
                    </FormControl>
                    {name === 'policyStart' ? (
                      <FormDescription>
                        Ages in the census are worked out on this date unless the Data Sheet sets
                        another.
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name="ownerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned to</FormLabel>
                  <FormControl>
                    <NativeSelect
                      name={field.name}
                      ref={field.ref}
                      value={field.value ?? ''}
                      disabled={owners.isPending}
                      onChange={(event) => field.onChange(event.target.value || undefined)}
                    >
                      {owners.isPending ? <option value="">Loading staff…</option> : null}
                      {(owners.data?.items ?? []).map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotes needed by</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {type === 'RENEWAL' ? (
              <>
                <FormField
                  control={form.control}
                  name="existingInsurer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiring policy’s insurer</FormLabel>
                      <FormControl>
                        <Input maxLength={200} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="existingPolicyNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiring policy number (optional)</FormLabel>
                      <FormControl>
                        <Input maxLength={100} {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            ) : null}
          </CardContent>
        </Card>

        {generalError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(generalError)}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            Create group health case
          </Button>
          <Button asChild variant="outline">
            <Link href="/ghi">Cancel</Link>
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ClientSearch({ onChoose }: { onChoose: (client: Client) => void }) {
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 250);
  const results = useQuery({
    queryKey: ['clients', 'list', q, 'ghi'],
    queryFn: ({ signal }) =>
      apiFetch(`clients?limit=20${q ? `&q=${encodeURIComponent(q)}` : ''}`, {
        schema: ClientListResponseSchema,
        signal,
      }),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="grid gap-2">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute top-2.5 left-2.5 size-4 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search clients by name or GSTIN"
          placeholder="Search clients by name or GSTIN"
          className="pl-8"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      {results.isPending ? (
        <LoadingState label="Loading clients" />
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => void results.refetch()} />
      ) : results.data.items.length === 0 ? (
        <EmptyState
          title="No client found"
          description={
            <>
              Add the company in the{' '}
              <Link className="text-accent-strong hover:underline" href="/masters/clients">
                client master
              </Link>{' '}
              first.
            </>
          }
        />
      ) : (
        <ul className="grid max-h-72 gap-1 overflow-y-auto" aria-label="Clients">
          {results.data.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoose(item)}
                className="flex w-full flex-col items-start rounded-md border px-3 py-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.gstin ?? 'No GSTIN'} · {item.address.city}, {item.address.state}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
