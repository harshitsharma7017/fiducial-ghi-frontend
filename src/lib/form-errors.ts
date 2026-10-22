import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { ApiError } from '@/lib/api-client';

interface BodyIssue {
  location: 'body';
  path: string;
  message: string;
}

function bodyIssues(details: unknown): BodyIssue[] {
  if (!Array.isArray(details)) return [];
  return details.filter(
    (issue): issue is BodyIssue =>
      typeof issue === 'object' &&
      issue !== null &&
      (issue as BodyIssue).location === 'body' &&
      typeof (issue as BodyIssue).path === 'string' &&
      (issue as BodyIssue).path !== '' &&
      typeof (issue as BodyIssue).message === 'string',
  );
}

/**
 * Puts the API's field errors on the form's fields: each body issue of a 400 VALIDATION_ERROR
 * (the API's paths, such as "address.pincode", are the form's field names), plus any error code
 * mapped in `codeFields`. Returns true when at least one field got a message, so the caller can
 * skip the general error banner.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  codeFields: Partial<Record<string, FieldPath<T>>> = {},
): boolean {
  if (!(error instanceof ApiError)) return false;
  const field = codeFields[error.code];
  if (field) {
    setError(field, { message: error.message }, { shouldFocus: true });
    return true;
  }
  if (error.code !== 'VALIDATION_ERROR') return false;
  const issues = bodyIssues(error.details);
  issues.forEach((issue, index) => {
    setError(issue.path as FieldPath<T>, { message: issue.message }, { shouldFocus: index === 0 });
  });
  return issues.length > 0;
}
