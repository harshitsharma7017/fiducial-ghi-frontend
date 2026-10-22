import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Shown in the navbar while the BFF runs in mock mode (USE_MOCK_API=true). */
export function DemoBadge() {
  return (
    <Badge variant="warning" title="Demo users and sample data; Fiducial_backend is not called">
      <FlaskConical className="size-3" aria-hidden="true" />
      <span className="sm:hidden">Demo</span>
      <span className="hidden sm:inline">Demo mode</span>
    </Badge>
  );
}
