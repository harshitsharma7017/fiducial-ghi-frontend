import { ApiError } from '@/lib/api-client';

/** Error code the BFF returns for allowlisted API paths while in mock mode. */
export const DEMO_MODE_CODE = 'DEMO_MODE';

export const DEMO_MODE_MESSAGE =
  'Not available in demo mode: this page reads live data from Fiducial_backend.';

/** True when a request failed only because the BFF is in mock mode. */
export function isDemoModeError(error: unknown): boolean {
  return error instanceof ApiError && error.code === DEMO_MODE_CODE;
}
