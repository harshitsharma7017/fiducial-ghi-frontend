'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Field } from '@/components/eb/eb-ui';
import { fieldErrorsOf } from '@/components/claims/claim-fields';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { apiFetch } from '@/lib/api-client';
import { todayIst } from '@/lib/dates';
import { ebKeys } from '@/lib/eb/api';
import {
  EB_PRODUCTS,
  EB_PRODUCT_LABELS,
  FamilyPlanCodeSchema,
  FamilyPlanNameSchema,
  FamilyPlanSchema,
  type EbProduct,
} from '@/shared';
import { VersionEditor, bodyOf, draftErrors, emptyDraft } from './version-editor';

/** Server errors of the first version, keyed as the editor keys its fields. */
export function versionServerErrors(error: unknown, prefix = ''): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [path, message] of Object.entries(fieldErrorsOf(error))) {
    if (prefix && !path.startsWith(prefix)) continue;
    errors[path.slice(prefix.length)] = message ?? '';
  }
  return errors;
}

/**
 * A new family plan for one product, with its first version as a Draft (Requirement 12.1). The
 * code and product never change afterwards; nothing is sent while the form shows a problem.
 */
export function FamilyPlanFormSheet({
  trigger,
  initialProduct,
}: {
  trigger: ReactNode;
  initialProduct?: EbProduct;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>New family plan</SheetTitle>
          <SheetDescription>
            The plan starts with a Draft version. Activate it on the plan’s page.
          </SheetDescription>
        </SheetHeader>
        <PlanForm initialProduct={initialProduct} onSaved={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function PlanForm({
  initialProduct,
  onSaved,
}: {
  initialProduct?: EbProduct;
  onSaved: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [product, setProduct] = useState<EbProduct | ''>(initialProduct ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [draft, setDraft] = useState(() => emptyDraft(todayIst()));
  const [touched, setTouched] = useState(false);
  const create = useMutation({
    mutationFn: () =>
      apiFetch('family-plans', {
        method: 'POST',
        body: { product, code: code.trim(), name: name.trim(), firstVersion: bodyOf(draft) },
        schema: FamilyPlanSchema,
      }),
    onSuccess: (plan) => {
      void queryClient.invalidateQueries({ queryKey: ebKeys.plans });
      onSaved();
      router.push(`/masters/family-plans/${plan.id}`);
    },
  });
  const codeError = FamilyPlanCodeSchema.safeParse(code).error?.issues[0]?.message;
  const nameError = FamilyPlanNameSchema.safeParse(name).error?.issues[0]?.message;
  const serverErrors = versionServerErrors(create.error, 'firstVersion.');
  const serverFields = fieldErrorsOf(create.error);
  const invalid =
    !product ||
    Boolean(codeError) ||
    Boolean(nameError) ||
    Object.keys(draftErrors(draft)).length > 0;
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!invalid) create.mutate();
      }}
    >
      <div className="grid flex-1 gap-5 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Product">
            <NativeSelect
              value={product}
              onChange={(event) => setProduct(event.target.value as EbProduct | '')}
            >
              <option value="">Choose the product</option>
              {EB_PRODUCTS.map((item) => (
                <option key={item} value={item}>
                  {EB_PRODUCT_LABELS[item]}
                </option>
              ))}
            </NativeSelect>
            {touched && !product ? (
              <span className="text-xs text-destructive" role="alert">
                Choose the product
              </span>
            ) : null}
          </Field>
          <Field label="Plan code">
            <Input
              className="tabular uppercase"
              maxLength={20}
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            {(touched && codeError) || serverFields.code ? (
              <span className="text-xs text-destructive" role="alert">
                {(touched && codeError) || serverFields.code}
              </span>
            ) : null}
          </Field>
          <Field label="Plan name">
            <Input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
            {(touched && nameError) || serverFields.name ? (
              <span className="text-xs text-destructive" role="alert">
                {(touched && nameError) || serverFields.name}
              </span>
            ) : null}
          </Field>
        </div>
        <VersionEditor value={draft} onChange={setDraft} serverErrors={serverErrors} />
        {create.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(create.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t p-4">
        <Button type="submit" disabled={create.isPending || (touched && invalid)}>
          {create.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          Create the plan
        </Button>
      </div>
    </form>
  );
}
