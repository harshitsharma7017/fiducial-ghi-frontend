'use client';

import { useQuery } from '@tanstack/react-query';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { DownloadButton, Fact } from '@/components/ghi/ghi-ui';
import { ErrorState, LoadingState } from '@/components/states';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { caseApi } from '@/lib/api/ghi';
import { rfqVersionSummaryQuery, selectionSummaryQuery } from '@/lib/eb/api';
import {
  GHI_GENDERS,
  GHI_GENDER_LABELS,
  GHI_RELATIONSHIP_LABELS,
  SELECTION_MEASURE_LABELS,
  formatDate,
  formatDateTime,
  formatIndianNumber,
  type EbProduct,
  type GhiRfqVersion,
  type RfqSelectionSummaryResponse,
} from '@/shared';

const rupees = (value: string | null) =>
  value === null ? '—' : `₹${formatIndianNumber(value, 0)}`;

/**
 * The RFQ Selection Summary Sheet (N7) on the RFQ tab: worked out from the census as stored with
 * the case's age bands and cover rules, or, for an RFQ version, exactly as that version was
 * generated. Problems (members without cover, a valid date of birth, or a band) are listed and the
 * download waits for them; nothing is totalled over missing data.
 */
export function SelectionSummaryCard({
  caseId,
  product,
  versions,
}: {
  caseId: string;
  product: EbProduct;
  versions: readonly GhiRfqVersion[];
}) {
  const canExport = usePermission('proposals.export');
  const stored = versions.filter((version) => version.hasSelectionSummary);
  const [source, setSource] = useState<string>('CURRENT');
  const current = useQuery(selectionSummaryQuery(product, caseId));
  const version = useQuery(
    rfqVersionSummaryQuery(product, caseId, source === 'CURRENT' ? null : source),
  );
  const query = source === 'CURRENT' ? current : version;
  const base = `${caseApi(product, caseId)}/rfq/selection-summary/document`;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle>RFQ selection summary</CardTitle>
          <CardDescription>
            Employees, lives and cover by age band, gender and relationship, from the saved census.
            Added to each RFQ version as it is generated (Fiducial’s layout: the client’s has not
            been received).
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {stored.length > 0 ? (
            <NativeSelect
              aria-label="Which summary"
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="CURRENT">As the census is now</option>
              {stored.map((item) => (
                <option key={item.id} value={item.id}>
                  As in RFQ v{item.version}
                </option>
              ))}
            </NativeSelect>
          ) : null}
          {canExport &&
          source === 'CURRENT' &&
          current.data &&
          current.data.summary.problems.length === 0 ? (
            <>
              <DownloadButton
                path={`${base}?format=xlsx`}
                fallbackName={`${product}-RFQ-Selection-Summary.xlsx`}
              >
                Excel
              </DownloadButton>
              <DownloadButton
                path={`${base}?format=pdf`}
                fallbackName={`${product}-RFQ-Selection-Summary.pdf`}
              >
                PDF
              </DownloadButton>
            </>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <LoadingState label="Working out the summary" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <SummaryBody response={query.data} />
        )}
      </CardContent>
    </Card>
  );
}

export function SummaryBody({ response }: { response: RfqSelectionSummaryResponse }) {
  const { header, summary } = response;
  const measure = SELECTION_MEASURE_LABELS[summary.measure];
  return (
    <div className="grid gap-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        <Fact label="Company">{header.company}</Fact>
        <Fact label="Case">{header.reference}</Fact>
        <Fact label="Product">{`${header.product} (${header.productName})`}</Fact>
        <Fact label="Policy period">{header.policyPeriod}</Fact>
        <Fact label="Ages on">{formatDate(header.referenceDate)}</Fact>
        <Fact label="Age bands">
          {header.ageBands.name}
          {header.ageBands.revision === null ? '' : ` (revision ${header.ageBands.revision})`}
        </Fact>
        <Fact label="Family plan">{header.plan ?? 'The Data Sheet’s family definition'}</Fact>
        <Fact
          label={
            response.source === 'RFQ_VERSION'
              ? `Generated with RFQ v${response.rfqVersion ?? ''}`
              : 'Worked out'
          }
        >
          {formatDateTime(header.generatedAt)}
        </Fact>
        {header.rules.map((rule) => (
          <Fact key={rule.label} label={rule.label}>
            {rule.value}
          </Fact>
        ))}
      </dl>

      {summary.problems.length > 0 ? (
        <Alert variant="warning">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>The summary is not complete</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {summary.problems.map((problem) => (
                <li key={problem.code}>{problem.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <p className="flex items-center gap-1.5 text-success">
          <CircleCheck aria-hidden="true" className="size-4" />
          Every count and total agrees with the census
          {summary.reconciled ? '' : ' — except as listed'}.
        </p>
      )}

      <section aria-label={`A. Employees and ${measure.toLowerCase()}`} className="grid gap-2">
        <h3 className="font-medium">A. Employees and {measure.toLowerCase()}</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{measure}</TableHead>
                <TableHead className="text-right">Employees</TableHead>
                <TableHead className="text-right">Lives</TableHead>
                <TableHead className="text-right">Total {measure.toLowerCase()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.coverage.rows.map((row) => (
                <TableRow key={row.amount}>
                  <TableCell className="tabular">{rupees(row.amount)}</TableCell>
                  <TableCell className="text-right tabular">{row.employees}</TableCell>
                  <TableCell className="text-right tabular">{row.lives}</TableCell>
                  <TableCell className="text-right tabular">{rupees(row.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular">{summary.coverage.employees}</TableCell>
                <TableCell className="text-right tabular">{summary.coverage.lives}</TableCell>
                <TableCell className="text-right tabular">
                  {rupees(summary.coverage.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        {summary.floater ? (
          <p className="text-xs text-muted-foreground">
            Family floater: each family’s sum insured is counted once, on the employee.
          </p>
        ) : null}
      </section>

      <section aria-label="B. Lives by age band" className="grid gap-2">
        <h3 className="font-medium">B. Lives by age band and {measure.toLowerCase()}</h3>
        <div
          role="region"
          aria-label="Age band matrix"
          tabIndex={0}
          className="overflow-x-auto rounded-md border"
        >
          <Table>
            <TableCaption className="sr-only">
              Lives in each age band by {measure.toLowerCase()}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Age band</TableHead>
                {summary.categories.map((amount) => (
                  <TableHead key={amount} className="text-right">
                    {rupees(amount)}
                  </TableHead>
                ))}
                <TableHead className="text-right">Lives</TableHead>
                <TableHead className="text-right">Total {measure.toLowerCase()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.matrix.rows.map((row) => (
                <TableRow
                  key={`${row.kind}-${row.label}`}
                  className={row.kind === 'BAND' ? undefined : 'text-warning'}
                >
                  <TableCell>{row.label}</TableCell>
                  {row.lives.map((lives, index) => (
                    <TableCell key={summary.categories[index]} className="text-right tabular">
                      {lives}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular">{row.totalLives}</TableCell>
                  <TableCell className="text-right tabular">{rupees(row.totalCover)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                {summary.matrix.totals.lives.map((lives, index) => (
                  <TableCell key={summary.categories[index]} className="text-right tabular">
                    {lives}
                  </TableCell>
                ))}
                <TableCell className="text-right tabular">
                  {summary.matrix.totals.totalLives}
                </TableCell>
                <TableCell className="text-right tabular">
                  {rupees(summary.matrix.totals.totalCover)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section aria-label="C. Gender and relationship" className="grid gap-2">
          <h3 className="font-medium">C. Gender and relationship</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {GHI_GENDERS.map((gender) => (
              <Fact key={gender} label={GHI_GENDER_LABELS[gender]}>
                {summary.genders[gender]}
              </Fact>
            ))}
            {(
              [
                'SELF',
                'SPOUSE',
                'CHILD',
                'FATHER',
                'MOTHER',
                'FATHER_IN_LAW',
                'MOTHER_IN_LAW',
              ] as const
            ).map((relationship) => (
              <Fact key={relationship} label={GHI_RELATIONSHIP_LABELS[relationship]}>
                {summary.relationships[relationship]}
              </Fact>
            ))}
            <Fact label="Parents">{summary.groups.parents}</Fact>
            <Fact label="Parents-in-law">{summary.groups.parentsInLaw}</Fact>
          </dl>
        </section>
        <section aria-label={`D. ${measure} by relationship`} className="grid gap-2">
          <h3 className="font-medium">D. {measure} by relationship</h3>
          <ul className="grid gap-1">
            {summary.byRelationship.map((row) => (
              <li key={row.relationship} className="flex justify-between gap-2">
                <span>
                  {GHI_RELATIONSHIP_LABELS[row.relationship]} ({row.lives})
                </span>
                <span className="tabular">
                  {row.total === null ? 'Shares the family’s' : rupees(row.total)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
