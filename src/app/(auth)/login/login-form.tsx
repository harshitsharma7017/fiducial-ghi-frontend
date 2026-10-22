'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CircleAlert, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { safeNextPath } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  ApiErrorSchema,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_LOCKOUT_MINUTES,
  LOGIN_MAX_FAILED_ATTEMPTS,
  LoginRequestSchema,
} from '@/shared';

async function failureMessage(response: Response, demoMode: boolean): Promise<string> {
  if (response.status === 401) {
    // Mock mode has no account lockout, so it does not mention one.
    if (demoMode) return INVALID_CREDENTIALS_MESSAGE;
    return `${INVALID_CREDENTIALS_MESSAGE} After ${LOGIN_MAX_FAILED_ATTEMPTS} failed attempts the account is locked for ${LOGIN_LOCKOUT_MINUTES} minutes.`;
  }
  if (response.status === 429)
    return 'Too many sign-in attempts from this network. Wait a few minutes and try again.';
  const body = ApiErrorSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.message : 'Sign-in failed. Try again.';
}

export function LoginForm({ next, demoMode = false }: { next?: string; demoMode?: boolean }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm({
    resolver: zodResolver(LoginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    let response: Response;
    try {
      response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
    } catch {
      setFailure('Cannot reach the server. Check your connection and try again.');
      return;
    }
    if (response.ok) {
      // A full navigation, so every page starts from the new session.
      window.location.assign(safeNextPath(next));
      return;
    }
    setFailure(await failureMessage(response, demoMode));
    setShowPassword(false);
    form.setValue('password', '');
    form.setFocus('password');
  });

  const submitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {failure ? (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            ) : null}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="username" autoFocus {...field} />
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
                  <div className="flex items-center justify-between">
                    <FormLabel>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      className="rounded-sm text-xs text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="pr-10"
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword((shown) => !shown)}
                      className={cn(
                        'absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-muted-foreground outline-none',
                        'hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {showPassword ? 'Hide password' : 'Show password'}
                      </span>
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
