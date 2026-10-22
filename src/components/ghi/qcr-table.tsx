import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { GhiComparison, GhiQcr } from '@/shared';
import { inr } from './ghi-ui';

const KIND_TEXT: Record<GhiComparison, string | null> = {
  MATCH: null,
  NOT_ASKED: null,
  BETTER: 'Better',
  DEVIATION: 'Deviation',
  MISSING: 'Missing',
};
const KIND_CLASS: Record<GhiComparison, string> = {
  MATCH: '',
  NOT_ASKED: 'text-muted-foreground',
  BETTER: 'text-success',
  DEVIATION: 'bg-destructive-soft/50 text-destructive',
  MISSING: 'bg-warning-soft/50 text-warning',
};

/**
 * The QCR side by side (G6): what the RFQ asked for, then each insurer's premium and terms. The
 * lowest total is marked; deviations and missing information are flagged in words, not only colour.
 */
export function QcrTable({ qcr }: { qcr: GhiQcr }) {
  return (
    <div
      role="region"
      aria-label={`QCR v${qcr.version} comparison`}
      tabIndex={0}
      className="overflow-x-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-48">Item</TableHead>
            <TableHead className="min-w-40">Asked in the RFQ</TableHead>
            {qcr.columns.map((column) => (
              <TableHead key={column.quoteId} className="min-w-44 align-top">
                <span className="grid gap-1 py-1">
                  <span>{column.insurerName}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Quote v{column.quoteVersion}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {column.lowest ? <Badge variant="success">Lowest total</Badge> : null}
                    {column.recommended ? <Badge variant="default">Recommended</Badge> : null}
                  </span>
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {(['basePremium', 'gst', 'totalPremium'] as const).map((key) => (
            <TableRow key={key} className={key === 'totalPremium' ? 'font-semibold' : undefined}>
              <TableCell>
                {key === 'basePremium' ? 'Base premium' : key === 'gst' ? 'GST' : 'Total premium'}
              </TableCell>
              <TableCell />
              {qcr.columns.map((column) => (
                <TableCell
                  key={column.quoteId}
                  className={cn(
                    'text-right tabular',
                    key === 'totalPremium' && column.lowest && 'bg-success-soft text-success',
                  )}
                >
                  {inr(column[key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {qcr.rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell>{row.label}</TableCell>
              <TableCell className="text-muted-foreground">{row.requested}</TableCell>
              {row.values.map((value, index) => (
                <TableCell
                  key={qcr.columns[index]?.quoteId ?? index}
                  className={KIND_CLASS[value.kind]}
                >
                  {value.text}
                  {KIND_TEXT[value.kind] ? (
                    <span className="ml-1 text-xs font-medium">({KIND_TEXT[value.kind]})</span>
                  ) : null}
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="font-medium">
            <TableCell>Deviations / missing</TableCell>
            <TableCell />
            {qcr.columns.map((column) => (
              <TableCell key={column.quoteId} className="tabular">
                {column.deviations} / {column.missing}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
