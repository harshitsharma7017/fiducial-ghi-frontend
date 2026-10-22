import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  EmailTemplateListResponseSchema,
  EmailTemplateSchema,
  type EmailTemplateKind,
  type UpdateEmailTemplateRequest,
} from '@/shared';

/** The RFQ and Reminder email templates (masters.view). */
export function useEmailTemplates() {
  return useQuery({
    queryKey: queryKeys.emailTemplates,
    queryFn: ({ signal }) =>
      apiFetch('email-templates', { schema: EmailTemplateListResponseSchema, signal }),
  });
}

/** Saves a template with the version it was loaded at (masters.manage). */
export function useSaveEmailTemplate(kind: EmailTemplateKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateEmailTemplateRequest) =>
      apiFetch(`email-templates/${kind}`, { method: 'PUT', body, schema: EmailTemplateSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emailTemplates });
    },
  });
}
