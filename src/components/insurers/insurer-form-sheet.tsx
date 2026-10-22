'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { ContactsFieldset } from '@/components/forms/contacts-fieldset';
import { RfqEmailsField } from '@/components/insurers/rfq-emails-field';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
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
  CreateInsurerRequestSchema,
  InsurerSchema,
  type CreateInsurerFormValues,
  type CreateInsurerRequest,
  type Insurer,
} from '@/shared';

function toFormValues(insurer: Insurer | undefined): CreateInsurerFormValues {
  if (!insurer) return { company: '', branch: '', contacts: [], rfqEmails: [''] };
  return {
    company: insurer.company,
    branch: insurer.branch,
    contacts: insurer.contacts.map((contact) => ({
      name: contact.name,
      designation: contact.designation ?? '',
      email: contact.email ?? '',
      phone: contact.phone ?? '',
    })),
    rfqEmails: insurer.rfqEmails.length > 0 ? [...insurer.rfqEmails] : [''],
  };
}

function InsurerForm({ insurer, onSaved }: { insurer?: Insurer; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [generalError, setGeneralError] = useState<unknown>(null);
  const form = useForm<CreateInsurerFormValues, unknown, CreateInsurerRequest>({
    resolver: zodResolver(CreateInsurerRequestSchema),
    defaultValues: toFormValues(insurer),
    mode: 'onTouched',
  });

  const save = useMutation({
    mutationFn: (body: CreateInsurerRequest) =>
      insurer
        ? apiFetch(`insurers/${insurer.id}`, { method: 'PATCH', body, schema: InsurerSchema })
        : apiFetch('insurers', { method: 'POST', body, schema: InsurerSchema }),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.insurers.all });
      toast({
        title: insurer ? 'Insurer updated' : 'Insurer added',
        description: `${saved.company}, ${saved.branch}`,
        variant: 'success',
      });
      onSaved();
    },
    onError: (error) => {
      if (!applyServerFieldErrors(error, form.setError, { INSURER_EXISTS: 'branch' })) {
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
            name="company"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Insurance company</FormLabel>
                <FormControl>
                  <Input autoComplete="organization" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="branch"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch</FormLabel>
                <FormControl>
                  <Input autoComplete="off" placeholder="For example Fort, Mumbai" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RfqEmailsField />
          <ContactsFieldset description="Underwriters and relationship contacts at this branch." />
        </div>
        <div className="flex justify-end gap-2 border-t p-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {insurer ? 'Save changes' : 'Add insurer'}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/** Adds an insurer branch or edits one, in a side sheet. */
export function InsurerFormSheet({ insurer, trigger }: { insurer?: Insurer; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{insurer ? 'Edit insurer' : 'Add insurer'}</SheetTitle>
          <SheetDescription>
            One record per company branch. The RFQ screen sends to the addresses listed here.
          </SheetDescription>
        </SheetHeader>
        <InsurerForm insurer={insurer} onSaved={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
