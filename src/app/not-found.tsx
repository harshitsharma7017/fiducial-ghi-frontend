import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted-foreground">The page you asked for does not exist.</p>
      <Button asChild>
        <Link href="/ghi">Go to the GMC cases</Link>
      </Button>
    </main>
  );
}
