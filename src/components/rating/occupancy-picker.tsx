'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown } from 'lucide-react';
import { useId, useState, type KeyboardEvent, type Ref } from 'react';
import { useFormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { apiFetch } from '@/lib/api-client';
import { riskTypeLabel } from '@/lib/display';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { OccupancyListResponseSchema, type Occupancy } from '@/shared';

const RESULT_LIMIT = 10;

export interface OccupancyPickerProps {
  id?: string;
  /** The occupancy already chosen, shown when the picker opens (for example in an edit form). */
  initialValue?: { tacCode: string; description: string } | null;
  /** Called with the chosen occupancy, or null when the text no longer matches a choice. */
  onSelect: (occupancy: Occupancy | null) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Search-as-you-type occupancy picker following the ARIA combobox pattern. */
export function OccupancyPicker({
  id,
  initialValue,
  onSelect,
  onBlur,
  invalid,
  describedBy,
  ref,
}: OccupancyPickerProps) {
  const listboxId = useId();
  const [text, setText] = useState(() =>
    initialValue ? `${initialValue.tacCode} — ${initialValue.description}` : '',
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // True while the text shows a chosen occupancy rather than a search.
  const [selected, setSelected] = useState(Boolean(initialValue));
  const q = useDebouncedValue(text.trim(), 250);
  const searching = open && q.length > 0 && !selected;

  const results = useQuery({
    queryKey: [...queryKeys.occupancies(q), 'picker'],
    queryFn: ({ signal }) =>
      apiFetch(
        `masters/occupancies?${new URLSearchParams({ q, limit: String(RESULT_LIMIT) }).toString()}`,
        {
          schema: OccupancyListResponseSchema,
          signal,
        },
      ),
    enabled: searching,
  });
  const options = searching ? (results.data?.items ?? []) : [];
  const expanded = searching;
  const activeOption = options[activeIndex];

  function choose(option: Occupancy) {
    setSelected(true);
    setText(`${option.tacCode} — ${option.description}`);
    setOpen(false);
    onSelect(option);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && expanded && activeOption) {
      event.preventDefault();
      choose(activeOption);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        id={id}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={expanded ? listboxId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={expanded && activeOption ? `${listboxId}-${activeIndex}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Type a code or words, for example 2001 or abrasive"
        value={text}
        className="pr-9"
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActiveIndex(0);
          if (selected) {
            setSelected(false);
            onSelect(null);
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          onBlur?.();
        }}
      />
      <ChevronsUpDown
        className="pointer-events-none absolute top-2.5 right-3 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      {expanded ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Matching occupancies"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md"
        >
          {results.isPending ? (
            <li role="presentation" className="px-3 py-2 text-muted-foreground">
              Searching…
            </li>
          ) : options.length === 0 ? (
            <li role="presentation" className="px-3 py-2 text-muted-foreground">
              {results.isError
                ? 'Search failed. Keep typing to try again.'
                : `No occupancies match “${q}”`}
            </li>
          ) : (
            options.map((option, index) => (
              <li
                key={option.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                className={cn(
                  'flex cursor-pointer gap-3 px-3 py-2',
                  index === activeIndex && 'bg-muted',
                )}
                // Keep focus in the input so the list does not close before the click lands.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span className="tabular w-16 shrink-0 font-medium">{option.tacCode}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2">{option.description}</span>
                  <span className="text-xs text-muted-foreground">
                    Fire risk: {riskTypeLabel(option.fireRiskType)}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

/** Wires the combobox to the surrounding FormItem's ids and error state. */
export function OccupancyField({
  initialValue,
  onSelect,
  onBlur,
  ref,
}: Pick<OccupancyPickerProps, 'initialValue'> & {
  onSelect: (occupancy: Occupancy | null) => void;
  onBlur: () => void;
  ref: Ref<HTMLInputElement>;
}) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField();
  return (
    <OccupancyPicker
      id={formItemId}
      ref={ref}
      initialValue={initialValue}
      onSelect={onSelect}
      onBlur={onBlur}
      invalid={Boolean(error)}
      describedBy={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
    />
  );
}
