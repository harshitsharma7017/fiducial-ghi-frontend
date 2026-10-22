'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { useForm, useWatch, type DefaultValues } from 'react-hook-form';
import { AddressFieldset } from '@/components/clients/address-fieldset';
import { ContactsFieldset } from '@/components/forms/contacts-fieldset';
import { OccupancyField } from '@/components/rating/occupancy-picker';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api-client';
import { applyServerFieldErrors } from '@/lib/form-errors';
import { queryKeys } from '@/lib/query-keys';
import {
  ClientSchema,
  CreateClientRequestSchema,
  GSTIN_EXAMPLE,
  GST_STATE_CODES,
  gstinProblem,
  type Client,
  type CreateClientFormValues,
  type CreateClientRequest,
} from '@/shared';

function toFormValues(client: Client | undefined): DefaultValues<CreateClientFormValues> {
  if (!client) {
    return {
      name: '',
      gstin: '',
      address: { line1: '', line2: '', city: '', state: undefined, pincode: '' },
      contacts: [],
      natureOfBusiness: '',
      occupancyCode: '',
    };
  }
  return {
    name: client.name,
    gstin: client.gstin ?? '',
    address: {
      ...client.address,
      line2: client.address.line2 ?? '',
      state: client.address.state as CreateClientFormValues['address']['state'],
    },
    contacts: client.contacts.map((contact) => ({
      name: contact.name,
      designation: contact.designation ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    })),
    natureOfBusiness: client.natureOfBusiness,
    occupancyCode: client.occupancy.tacCode,
  };
}

/** "Registered in Maharashtra" once the GSTIN typed so far is a valid one. */
function GstinHint({ value }: { value: string }) {
  const gstin = value.replace(/\s+/g, '').toUpperCase();
  const state =
    gstin.length === 15 && !gstinProblem(gstin) ? GST_STATE_CODES[gstin.slice(0, 2)] : null;
  return (
    <FormDescription>
      {state
        ? `Valid GSTIN, registered in ${state}.`
        : `15 characters, for example ${GSTIN_EXAMPLE}. Leave empty if the insured has no GST registration.`}
    </FormDescription>
  );
}

function ClientForm({ client, onSaved }: { client?: Client; onSaved: (saved: Client) => void }) {
  const queryClient = useQueryClient();
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<CreateClientFormValues, unknown, CreateClientRequest>({
    resolver: zodResolver(CreateClientRequestSchema),
    defaultValues: toFormValues(client),
    mode: 'onTouched',
  });
  const gstin = useWatch({ control: form.control, name: 'gstin' }) ?? '';

  const save = useMutation({
    mutationFn: (body: CreateClientRequest) =>
      client
        ? apiFetch(`clients/${client.id}`, { method: 'PATCH', body, schema: ClientSchema })
        : apiFetch('clients', { method: 'POST', body, schema: ClientSchema }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toast({
        title: client ? 'Client updated' : 'Client created',
        description: saved.name,
        variant: 'success',
      });
      onSaved(saved);
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError, { GSTIN_TAKEN: 'gstin' })) {
        setGeneralError(error);
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setGeneralError(null);
    save.mutate(values);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="grid flex-1 gap-5 overflow-y-auto p-5">
          {generalError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(generalError)}</AlertDescription>
            </Alert>
          ) : null}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Insured name</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="gstin"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GSTIN</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={20}
                    className="tabular uppercase"
                    {...field}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <GstinHint value={gstin} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="natureOfBusiness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nature of business</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="For example Textile weaving" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="occupancyCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Occupancy</FormLabel>
                <OccupancyField
                  ref={field.ref}
                  initialValue={client?.occupancy}
                  onBlur={field.onBlur}
                  onSelect={(choice) => field.onChange(choice?.tacCode ?? '')}
                />
                <FormDescription>
                  From the active IIB occupancy master. Risk locations use it unless they have their
                  own.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <AddressFieldset />
          <ContactsFieldset description="People at the insured to contact about this placement." />
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {client ? 'Save changes' : 'Create client'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Creates a client (then opens its page) or edits one, in a side sheet. */
export function ClientFormSheet({ client, trigger }: { client?: Client; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{client ? 'Edit client' : 'New client'}</SheetTitle>
          <SheetDescription>
            {client
              ? 'Changes are saved to the client master and recorded in the audit log.'
              : 'The insured as named on the Data Sheet. Add risk locations after saving.'}
          </SheetDescription>
        </SheetHeader>
        {/* The sheet unmounts its content once closed, so each opening starts from the saved values. */}
        <ClientForm
          client={client}
          onSaved={(saved) => {
            setOpen(false);
            if (!client) router.push(`/masters/clients/${saved.id}`);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
