'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { apiFetch } from '@/lib/api-client';
import { refreshGhiCase } from '@/lib/api/ghi';
import { todayIst } from '@/lib/dates';
import { applyServerFieldErrors } from '@/lib/form-errors';
import {
  GHI_GENDERS,
  GHI_GENDER_LABELS,
  GHI_RELATIONSHIPS,
  GHI_RELATIONSHIP_LABELS,
  GhiMemberInputSchema,
  GhiMemberSchema,
  type GhiCaseRecord,
  type GhiMember,
  type GhiMemberFormValues,
  type GhiMemberInput,
} from '@/shared';

/**
 * Adds or edits one census member (G3). The API checks the family rules, the Data Sheet's
 * eligibility and age limits, and duplicates; its messages land on the fields.
 */
export function MemberDialog({
  record,
  member,
  onClose,
}: {
  record: GhiCaseRecord;
  member: GhiMember | null;
  onClose: (saved: GhiMember | null) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<GhiMemberFormValues, unknown, GhiMemberInput>({
    resolver: zodResolver(GhiMemberInputSchema),
    defaultValues: member
      ? {
          employeeId: member.employeeId,
          name: member.name,
          gender: member.gender,
          dateOfBirth: member.dateOfBirth ?? '',
          relationship: member.relationship,
          dateOfJoining: member.dateOfJoining ?? '',
          sumInsured: member.sumInsured ?? '',
        }
      : {
          employeeId: '',
          name: '',
          gender: 'MALE',
          dateOfBirth: '',
          relationship: 'SELF',
          dateOfJoining: '',
          sumInsured: '',
        },
  });
  const relationship = useWatch({ control: form.control, name: 'relationship' });
  const save = useMutation({
    mutationFn: (body: GhiMemberInput) =>
      apiFetch(
        member ? `ghi/cases/${record.id}/members/${member.id}` : `ghi/cases/${record.id}/members`,
        {
          method: member ? 'PUT' : 'POST',
          body,
          schema: GhiMemberSchema,
        },
      ),
    onSuccess: (saved) => {
      refreshGhiCase(queryClient, record.id);
      onClose(saved);
    },
    onError: (error) => {
      applyServerFieldErrors(error, form.setError);
    },
  });
  const options = record.requirements.sumInsuredOptions;
  const floaterDependant =
    record.requirements.coverageType === 'FLOATER' && relationship !== 'SELF';

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose(null))}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{member ? 'Edit member' : 'Add member'}</DialogTitle>
          <DialogDescription>
            Dependants use their employee’s ID. Ages are worked out on the case’s age reference
            date.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(event) => void form.handleSubmit((values) => save.mutate(values))(event)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee ID</FormLabel>
                    <FormControl>
                      <Input maxLength={40} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        {GHI_RELATIONSHIPS.map((value) => (
                          <option key={value} value={value}>
                            {GHI_RELATIONSHIP_LABELS[value]}
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
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input maxLength={120} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <FormControl>
                      <NativeSelect {...field}>
                        {GHI_GENDERS.map((value) => (
                          <option key={value} value={value}>
                            {GHI_GENDER_LABELS[value]}
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
                name="dateOfBirth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of birth</FormLabel>
                    <FormControl>
                      <Input type="date" max={todayIst()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dateOfJoining"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Date of joining{relationship === 'SELF' ? '' : ' (employee’s, optional)'}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sumInsured"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sum insured (₹)</FormLabel>
                    <FormControl>
                      {options.length > 0 ? (
                        <NativeSelect {...field} value={field.value ?? ''}>
                          <option value="">
                            {floaterDependant ? 'The employee’s (family floater)' : 'Choose'}
                          </option>
                          {options.map((option) => (
                            <option key={option} value={option}>
                              ₹{Number(option).toLocaleString('en-IN')}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Input inputMode="numeric" {...field} value={field.value ?? ''} />
                      )}
                    </FormControl>
                    {floaterDependant ? (
                      <FormDescription>
                        Family floater: leave blank to share the employee’s.
                      </FormDescription>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {save.isError && !form.formState.errors.root ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(save.error)}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                {member ? 'Save member' : 'Add member'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
