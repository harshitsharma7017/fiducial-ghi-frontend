'use client';

import { useFormContext } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { INDIAN_STATES, type AddressFormValues } from '@/shared';

/** The client's communication address. Edits the surrounding form's `address` field. */
export function AddressFieldset() {
  const form = useFormContext<{ address: AddressFormValues }>();
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-medium">Communication address</legend>
      <FormField
        control={form.control}
        name="address.line1"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address line 1</FormLabel>
            <FormControl>
              <Input autoComplete="address-line1" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="address.line2"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Address line 2 <span className="font-normal text-muted-foreground">(optional)</span>
            </FormLabel>
            <FormControl>
              <Input autoComplete="address-line2" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="address.city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input autoComplete="address-level2" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address.state"
          render={({ field }) => (
            <FormItem>
              <FormLabel>State</FormLabel>
              <FormControl>
                <NativeSelect {...field} value={field.value ?? ''}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
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
          name="address.pincode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pincode</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(event) =>
                    field.onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="postal-code"
                  className="tabular"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  );
}
