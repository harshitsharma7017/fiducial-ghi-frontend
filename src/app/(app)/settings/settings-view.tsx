'use client';

import { PageHeader } from '@/components/page-header';
import { MailCard } from '@/components/settings/mail-card';
import { MasterDataCard } from '@/components/settings/master-data-card';
import { SystemStatusCard } from '@/components/settings/system-status-card';
import { AccessDeniedState, DemoModeState, LoadingState } from '@/components/states';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useDemoMode } from '@/hooks/use-demo-mode';
import { can } from '@/shared';

/**
 * Needs settings.view (Admin). Users without it, and demo mode, never send the status and master
 * requests. The shell's page gate already stops other roles; this check keeps the view safe on
 * its own.
 */
export function SettingsView() {
  const me = useCurrentUser();
  const demoMode = useDemoMode();

  let content;
  if (!me.data) content = <LoadingState label="Loading your account…" />;
  else if (!can(me.data.roles, 'settings.view'))
    content = <AccessDeniedState description="Only admins can open Settings." />;
  else if (demoMode) content = <DemoModeState />;
  else
    content = (
      <div className="grid gap-4 lg:grid-cols-2">
        <SystemStatusCard />
        <MasterDataCard />
        <MailCard />
      </div>
    );

  return (
    <>
      <PageHeader
        title="Settings"
        description="System status, the active master data and how mail is sent."
      />
      {content}
    </>
  );
}
