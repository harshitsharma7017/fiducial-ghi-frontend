'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Pager } from '@/components/ghi/ghi-ui';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { companyEmployeesQuery } from '@/lib/eb/api';
import {
  EB_PRODUCT_LABELS,
  GHI_GENDER_LABELS,
  ebCasePath,
  formatDate,
  type EbEmployee,
} from '@/shared';
import { EmployeeDialog } from './employee-dialog';

const COLUMNS = 6;

/**
 * The company's employees across GMC, GPA and GTLI (Requirement 17.8): one row per employee with
 * the cases they are in, 50 a page, unresolved ones first. Correcting or resolving needs
 * proposals.edit.
 */
export function EmployeesCard({ clientId }: { clientId: string }) {
  const searchId = useId();
  const canEdit = usePermission('employees.update');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EbEmployee | null>(null);
  const employees = useQuery({
    ...companyEmployeesQuery(clientId, q, page),
    placeholderData: keepPreviousData,
  });

  let body;
  if (employees.isPending) body = <TableLoadingRows columns={COLUMNS} />;
  else if (employees.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState error={employees.error} onRetry={() => void employees.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (employees.data.items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title={q ? `No employees match “${q}”` : 'No employees yet'}
            description={
              q
                ? 'Search by employee ID or name.'
                : 'Employees appear as census members are added to this company’s cases.'
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = employees.data.items.map((employee) => (
      <TableRow key={employee.employeeKey}>
        <TableCell className="tabular whitespace-nowrap">{employee.employeeId}</TableCell>
        <TableCell className="font-medium">
          {employee.name}
          {employee.unresolved ? (
            <Badge variant="warning" className="ml-2">
              Details disagree
            </Badge>
          ) : null}
        </TableCell>
        <TableCell>{GHI_GENDER_LABELS[employee.gender]}</TableCell>
        <TableCell className="tabular whitespace-nowrap">
          {employee.dateOfBirth ? (
            formatDate(employee.dateOfBirth)
          ) : (
            <span className="text-muted-foreground">Hidden</span>
          )}
        </TableCell>
        <TableCell>
          <ul className="grid gap-0.5">
            {employee.enrollments.map((item) => (
              <li key={item.caseId}>
                <Link
                  className="text-accent-strong hover:underline"
                  href={ebCasePath(item.product, item.caseId)}
                >
                  {item.reference}
                </Link>{' '}
                <span className="text-muted-foreground">({EB_PRODUCT_LABELS[item.product]})</span>
              </li>
            ))}
          </ul>
        </TableCell>
        <TableCell className="text-right">
          {canEdit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(employee)}>
              {employee.unresolved ? 'Resolve' : 'Update'}
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
    ));
  }

  const data = employees.data;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Employees</CardTitle>
        <CardDescription>
          One record per employee, shared by the company’s GMC, GPA and GTLI cases.
          {data && data.unresolved > 0
            ? ` ${data.unresolved} need${data.unresolved === 1 ? 's' : ''} resolving: their cases disagree on name, gender or date of birth.`
            : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid max-w-md gap-2">
          <Label htmlFor={searchId}>Search by employee ID or name</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <Table>
          <TableCaption className="sr-only">Employees of the company</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Date of birth</TableHead>
              <TableHead>Cases</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
        {data && data.total > data.limit ? (
          <Pager
            page={data.page}
            pages={Math.max(1, Math.ceil(data.total / data.limit))}
            total={data.total}
            onPage={setPage}
          />
        ) : null}
      </CardContent>
      {editing ? (
        <EmployeeDialog clientId={clientId} employee={editing} onClose={() => setEditing(null)} />
      ) : null}
    </Card>
  );
}
