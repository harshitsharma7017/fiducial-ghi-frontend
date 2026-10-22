import type { Metadata } from 'next';
import { LoginForm } from './login-form';
import { isMockApi } from '@/lib/server/mock-mode';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === 'string' ? next : undefined} demoMode={isMockApi()} />;
}
