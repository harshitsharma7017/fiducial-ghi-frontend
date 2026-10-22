import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Address, Client, Contact } from '@/shared';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[12rem_1fr] sm:gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function AddressLines({ address }: { address: Address }) {
  return (
    <span className="grid">
      <span>{address.line1}</span>
      {address.line2 ? <span>{address.line2}</span> : null}
      <span>
        {address.city}, {address.state} <span className="tabular">{address.pincode}</span>
      </span>
    </span>
  );
}

export function ContactList({ contacts }: { contacts: readonly Contact[] }) {
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground">No contacts.</p>;
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {contacts.map((contact, index) => (
        <li key={index} className="grid gap-0.5 rounded-md border p-3 text-sm">
          <span className="font-medium">{contact.name}</span>
          {contact.designation ? (
            <span className="text-muted-foreground">{contact.designation}</span>
          ) : null}
          {contact.email ? (
            <a
              href={`mailto:${contact.email}`}
              className="w-fit rounded-sm break-all text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {contact.email}
            </a>
          ) : null}
          {contact.phone ? <span className="tabular">{contact.phone}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** The client master record: what the Data Sheet repeats on every output. */
export function ClientDetailsCard({ client }: { client: Client }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm">
            <Field label="GSTIN">
              {client.gstin ? (
                <span className="tabular">{client.gstin}</span>
              ) : (
                <Badge variant="muted">No GSTIN</Badge>
              )}
            </Field>
            <Field label="Nature of business">{client.natureOfBusiness}</Field>
            <Field label="Occupancy">
              <span className="tabular">{client.occupancy.tacCode}</span> —{' '}
              {client.occupancy.description}
            </Field>
            <Field label="Communication address">
              <AddressLines address={client.address} />
            </Field>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactList contacts={client.contacts} />
        </CardContent>
      </Card>
    </div>
  );
}
