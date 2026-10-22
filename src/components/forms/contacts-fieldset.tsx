'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { MAX_CONTACTS, type ContactFormValues } from '@/shared';

export const EMPTY_CONTACT: ContactFormValues = { name: '', designation: '', email: '', phone: '' };

type ContactField = keyof ContactFormValues;

const FIELDS: readonly {
  name: ContactField;
  label: string;
  type?: string;
  autoComplete: string;
}[] = [
  { name: 'name', label: 'Name', autoComplete: 'off' },
  { name: 'designation', label: 'Designation', autoComplete: 'off' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'off' },
  { name: 'phone', label: 'Phone', type: 'tel', autoComplete: 'off' },
];

/**
 * The contacts of a client or insurer: add, edit and remove people. Each needs a name and an
 * email or a phone number. Reads the surrounding form, whose `contacts` field it edits.
 */
export function ContactsFieldset({ description }: { description?: string }) {
  const form = useFormContext<{ contacts: ContactFormValues[] }>();
  const contacts = useFieldArray({ control: form.control, name: 'contacts' });
  const listError = form.formState.errors.contacts?.root?.message;

  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Contacts</legend>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {contacts.fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : null}
      {contacts.fields.map((contact, index) => (
        <div key={contact.id} className="grid gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Contact {index + 1}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => contacts.remove(index)}
              aria-label={`Remove contact ${index + 1}`}
            >
              <Trash2 aria-hidden="true" />
              Remove
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((input) => (
              <FormField
                key={input.name}
                control={form.control}
                name={`contacts.${index}.${input.name}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{input.label}</FormLabel>
                    <FormControl>
                      <Input
                        type={input.type}
                        autoComplete={input.autoComplete}
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
      ))}
      {listError ? (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => contacts.append({ ...EMPTY_CONTACT })}
          disabled={contacts.fields.length >= MAX_CONTACTS}
        >
          <Plus aria-hidden="true" />
          Add contact
        </Button>
      </div>
    </fieldset>
  );
}
