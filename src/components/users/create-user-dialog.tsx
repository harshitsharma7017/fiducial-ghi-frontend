'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  DialogTrigger,
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
import { toast } from '@/hooks/use-toast';
import { ApiError, apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  CreateUserRequestSchema,
  PASSWORD_MIN_LENGTH,
  UserSchema,
  type CreateUserRequest,
} from '@/shared';
import { RolesFieldset } from './roles-fieldset';

const EMPTY: CreateUserRequest = { name: '', email: '', password: '', roles: [] };

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm({ resolver: zodResolver(CreateUserRequestSchema), defaultValues: EMPTY });

  const create = useMutation({
    mutationFn: (body: CreateUserRequest) =>
      apiFetch('users', { method: 'POST', body, schema: UserSchema }),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      toast({
        title: 'User created',
        description: `${user.name} can now sign in.`,
        variant: 'success',
      });
      setOpen(false);
      form.reset(EMPTY);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
        form.setError('email', { message: 'A user with this email already exists' });
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => create.mutate(values));
  const showGeneralError =
    create.isError && !(create.error instanceof ApiError && create.error.code === 'EMAIL_TAKEN');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          form.reset(EMPTY);
          create.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Create user
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>The user signs in with this email and password.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {showGeneralError ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{errorMessage(create.error)}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormDescription>
                    At least {PASSWORD_MIN_LENGTH} characters. A passphrase works well.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={({ field, fieldState }) => (
                <RolesFieldset
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message}
                />
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                ) : null}
                Create user
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
