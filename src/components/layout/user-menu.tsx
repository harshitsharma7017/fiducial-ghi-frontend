'use client';

import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { initials, rolesLabel } from '@/lib/display';
import type { User } from '@/shared';

/** Name, email and role; Profile; Sign out. Below 640 px the trigger shows the initials. */
export function UserMenu({ user }: { user: User | undefined }) {
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return <Skeleton className="h-8 w-8 rounded-full sm:w-28 sm:rounded-md" />;

  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Sign-out failed');
      queryClient.clear();
      // A full page load on purpose: nothing from the ended session stays in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      toast({ title: 'Could not sign out', description: 'Try again.', variant: 'destructive' });
    }
  }

  const roles = rolesLabel(user);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto gap-2 px-1.5 py-1 text-left sm:px-2">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary sm:hidden"
          >
            {initials(user.name)}
          </span>
          <span className="sr-only sm:not-sr-only sm:grid sm:leading-tight">
            <span className="font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{roles}</span>
          </span>
          <ChevronDown aria-hidden="true" className="hidden text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="grid gap-0.5">
          <span>{user.name}</span>
          <span className="text-xs font-normal break-all text-muted-foreground">{user.email}</span>
          <span className="text-xs font-normal text-muted-foreground">{roles}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signingOut} onSelect={() => void signOut()}>
          <LogOut aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
