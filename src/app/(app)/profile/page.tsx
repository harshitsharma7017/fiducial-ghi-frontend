import { Info } from 'lucide-react';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/page-header';
import { AccountCard } from '@/components/profile/account-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Your account and roles." />
      <div className="grid max-w-xl gap-4">
        <AccountCard />
        <Alert variant="info">
          <Info aria-hidden="true" />
          <AlertTitle>Profile settings are planned</AlertTitle>
          <AlertDescription>
            Changing your name or password here is not available yet. An admin can update your
            account under Users.
          </AlertDescription>
        </Alert>
      </div>
    </>
  );
}
