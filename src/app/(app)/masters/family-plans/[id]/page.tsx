import type { Metadata } from 'next';
import { DemoModeGate } from '@/components/demo-mode-gate';
import { FamilyPlanView } from './family-plan-view';

export const metadata: Metadata = { title: 'Family plan' };

export default async function FamilyPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DemoModeGate>
      <FamilyPlanView id={id} />
    </DemoModeGate>
  );
}
