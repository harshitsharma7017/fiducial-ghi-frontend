'use client';

import { TemplateEditor } from '@/components/email-templates/template-editor';
import { useEmailTemplates } from '@/components/email-templates/use-email-templates';
import { PageHeader } from '@/components/page-header';
import { ErrorState, LoadingState } from '@/components/states';
import { usePermission } from '@/hooks/use-permission';

/** E-2: the wording of the RFQ and reminder mails, edited by Admins without a developer. */
export function EmailTemplatesView() {
  const canManage = usePermission('masters.manage');
  const templates = useEmailTemplates();

  return (
    <>
      <PageHeader
        title="Email templates"
        description="The subject and message of the mails sent to insurers. Merge fields are filled for each insurer when the mail is sent; the preview uses the same rules."
      />
      {templates.isPending ? (
        <LoadingState label="Loading email templates" />
      ) : templates.isError ? (
        <ErrorState error={templates.error} onRetry={() => void templates.refetch()} />
      ) : (
        <div className="grid gap-4">
          {templates.data.items.map((template) => (
            <TemplateEditor
              key={`${template.kind}-${template.version}`}
              template={template}
              canManage={canManage}
              onReload={() => void templates.refetch()}
            />
          ))}
        </div>
      )}
    </>
  );
}
