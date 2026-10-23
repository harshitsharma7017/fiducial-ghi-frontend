import { EB_PRODUCTS, EB_PRODUCT_LABELS, type EbProduct } from '@/shared';
import { cn } from '@/lib/utils';

const HINTS: Record<EbProduct, string> = {
  GMC: 'Hospitalisation cover for employees and their families.',
  GPA: 'Accidental death and disablement cover.',
  GTLI: 'Life cover for employees.',
};

/** The Employee Benefits product of a new case (Requirement 1.2): none chosen at first. */
export function ProductChoice({
  value,
  onChange,
  products = EB_PRODUCTS,
}: {
  value: EbProduct | null;
  onChange: (value: EbProduct) => void;
  /** The products offered (those the user may create); every product by default. */
  products?: readonly EbProduct[];
}) {
  return (
    <fieldset className="mb-6 grid max-w-3xl gap-2 sm:grid-cols-3">
      <legend className="mb-2 text-sm font-medium">Product</legend>
      {products.map((product) => {
        const checked = value === product;
        return (
          <label
            key={product}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 focus-within:ring-2 focus-within:ring-ring',
              checked ? 'border-primary bg-primary-soft/40' : 'hover:bg-muted',
            )}
          >
            <input
              type="radio"
              name="eb-product"
              value={product}
              checked={checked}
              onChange={() => onChange(product)}
              className="mt-1 accent-[var(--primary)]"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">{EB_PRODUCT_LABELS[product]}</span>
              <span className="text-xs text-muted-foreground">{HINTS[product]}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
