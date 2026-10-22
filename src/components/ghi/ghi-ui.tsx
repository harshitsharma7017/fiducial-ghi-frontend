'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Download, LoaderCircle, Paperclip, Upload } from 'lucide-react';
import type * as React from 'react';
import { useId, useRef } from 'react';
import { errorMessage } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { apiDownload, saveFile } from '@/lib/api-client';
import { ghiFileHref, ghiFilesQuery, uploadGhiFile } from '@/lib/api/ghi';
import { cn } from '@/lib/utils';
import {
  GHI_STAGES,
  QUOTE_ATTACHMENT_TYPES,
  formatIndianNumber,
  ghiStageLabel,
  type EbProduct,
  type GhiCaseType,
  type GhiFilePurpose,
  type GhiStage,
} from '@/shared';

type Variant = React.ComponentProps<typeof Badge>['variant'];

const STAGE_VARIANT: Record<GhiStage, Variant> = {
  CREATED: 'muted',
  DATA_SHEET: 'muted',
  RFQ: 'info',
  QCR: 'warning',
  APPROVAL: 'warning',
  FINAL_QCR: 'accent',
  PAYMENT: 'accent',
  PLACEMENT_SLIP: 'success',
  CLOSED: 'muted',
};

export function GhiStageBadge({
  stage,
  type,
  placed = false,
}: {
  stage: GhiStage;
  type: GhiCaseType;
  placed?: boolean;
}) {
  if (placed) return <Badge variant="success">Placed</Badge>;
  return <Badge variant={STAGE_VARIANT[stage]}>{ghiStageLabel(stage, type)}</Badge>;
}

/** Rupees with paise, Indian grouping: ₹1,45,679.00. */
export const inr = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 2)}`;
/** Whole rupees, Indian grouping: ₹5,00,000. */
export const rupees = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 0)}`;

export function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular">{children}</dd>
    </div>
  );
}

/** The GHI stages in order, the current one marked; each step opens the tab of its work. */
export function GhiStageStepper({
  stage,
  type,
  placed,
  onSelect,
  stages = GHI_STAGES,
}: {
  stage: GhiStage;
  type: GhiCaseType;
  placed: boolean;
  onSelect: (stage: GhiStage) => void;
  /** The product's stages in order (GPA and GTLI have no Final QCR). */
  stages?: readonly GhiStage[];
}) {
  const steps = stages.filter((value) => value !== 'CLOSED');
  const current = stage === 'CLOSED' ? -1 : steps.indexOf(stage);
  return (
    <nav aria-label="Stages">
      <ol className="flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {steps.map((value, index) => {
          const done = index < current || (placed && index === current);
          const isCurrent = index === current && !placed;
          return (
            <li key={value} className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(value)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isCurrent && 'border-primary bg-primary-soft font-medium text-primary',
                  done && 'border-transparent bg-success-soft text-success',
                  !isCurrent && !done && 'border-border text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full text-[10px] tabular',
                    isCurrent && 'bg-primary text-primary-foreground',
                    done && 'bg-success text-background',
                    !isCurrent && !done && 'bg-muted',
                  )}
                >
                  {done ? <Check className="size-2.5" /> : index + 1}
                </span>
                {ghiStageLabel(value, type)}
                {isCurrent ? <span className="sr-only"> (current stage)</span> : null}
                {done ? <span className="sr-only"> (completed)</span> : null}
              </button>
              {index < steps.length - 1 ? (
                <span aria-hidden="true" className="h-px w-3 bg-border" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Downloads a generated document through the proxy and saves it; refusals show as a toast. */
export function DownloadButton({
  path,
  fallbackName,
  children,
  variant = 'outline',
}: {
  path: string;
  fallbackName: string;
  children: React.ReactNode;
  variant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const download = useMutation({
    mutationFn: () => apiDownload(path, fallbackName),
    onSuccess: saveFile,
    onError: (error) =>
      toast({ title: 'Download failed', description: errorMessage(error), variant: 'destructive' }),
  });
  return (
    <Button
      type="button"
      variant={variant}
      disabled={download.isPending}
      onClick={() => download.mutate()}
    >
      {download.isPending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        <Download aria-hidden="true" />
      )}
      {children}
    </Button>
  );
}

const ACCEPT = [
  ...Object.keys(QUOTE_ATTACHMENT_TYPES),
  ...Object.values(QUOTE_ATTACHMENT_TYPES),
].join(',');

/**
 * The case's files kept for a purpose, to tick; and an upload that adds one (and ticks it). The
 * API checks the file's kind (PDF, mail, PNG or JPEG).
 */
export function FilePicker({
  caseId,
  product = 'GMC',
  purpose,
  label,
  value,
  onChange,
  error,
  disabled = false,
}: {
  caseId: string;
  /** The case's product: GPA and GTLI files are under /eb/{product}. */
  product?: EbProduct;
  purpose: GhiFilePurpose;
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const files = useQuery(ghiFilesQuery(caseId, product));
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const upload = useMutation({
    mutationFn: (file: File) => uploadGhiFile(caseId, purpose, file, product),
    onSuccess: (saved) => {
      void files.refetch();
      onChange([...value, saved.id]);
    },
  });
  const mine = (files.data?.items ?? []).filter((file) => file.purpose === purpose);
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {mine.length === 0 ? (
        <p className="text-xs text-muted-foreground">No file uploaded yet.</p>
      ) : null}
      <ul className="grid gap-1">
        {mine.map((file) => {
          const id = `${inputId}-${file.id}`;
          return (
            <li key={file.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={id}
                checked={value.includes(file.id)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...value, file.id] : value.filter((item) => item !== file.id))
                }
              />
              <Label htmlFor={id} className="font-normal">
                <Paperclip aria-hidden="true" className="size-3.5 text-muted-foreground" />
                {file.fileName}
              </Label>
              <a
                className="text-xs text-accent-strong hover:underline"
                href={ghiFileHref(caseId, file.id, product)}
              >
                Open
              </a>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          aria-label={`Upload: ${label}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload aria-hidden="true" />
          )}
          Upload a file
        </Button>
        {upload.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {errorMessage(upload.error)}
          </p>
        ) : null}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}

/** A yes / no / not answered choice, for the Data Sheet and the terms of a quote. */
export function YesNo({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  disabled?: boolean;
}) {
  const name = useId();
  const options: Array<{ value: boolean | null; text: string }> = [
    { value: true, text: 'Yes' },
    { value: false, text: 'No' },
    { value: null, text: 'Not stated' },
  ];
  return (
    <fieldset className="grid gap-1" disabled={disabled}>
      <legend className="text-sm">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((option) => (
          <label key={option.text} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="size-4 accent-[var(--primary)]"
            />
            {option.text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Page numbers for a list the API pages. */
export function Pager({
  page,
  pages,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground tabular">
        {total} in all · page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

/** Asks before an action that cannot be undone, in an accessible dialog. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
