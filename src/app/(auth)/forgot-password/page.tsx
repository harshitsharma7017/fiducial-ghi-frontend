import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Forgot password' };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          Self-service password reset is not available yet. Contact your administrator for help
          signing in.
        </p>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/login">
            <ArrowLeft aria-hidden="true" />
            Back to sign in
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
