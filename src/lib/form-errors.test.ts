import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { applyServerFieldErrors } from './form-errors';

describe('applyServerFieldErrors', () => {
  it('puts each body issue on its field and focuses the first', () => {
    const setError = vi.fn();
    const error = new ApiError(400, 'VALIDATION_ERROR', 'Request validation failed', [
      { location: 'body', path: 'occupancyCode', message: 'Not in the active master' },
      { location: 'body', path: 'address.pincode', message: 'Enter a 6-digit pincode' },
      { location: 'query', path: 'limit', message: 'Too big' },
    ]);
    expect(applyServerFieldErrors(error, setError)).toBe(true);
    expect(setError.mock.calls).toEqual([
      ['occupancyCode', { message: 'Not in the active master' }, { shouldFocus: true }],
      ['address.pincode', { message: 'Enter a 6-digit pincode' }, { shouldFocus: false }],
    ]);
  });

  it('maps an error code to a field', () => {
    const setError = vi.fn();
    const error = new ApiError(409, 'GSTIN_TAKEN', 'GSTIN 27AAPFU0939F1ZV already belongs to X');
    expect(applyServerFieldErrors(error, setError, { GSTIN_TAKEN: 'gstin' })).toBe(true);
    expect(setError).toHaveBeenCalledWith(
      'gstin',
      { message: 'GSTIN 27AAPFU0939F1ZV already belongs to X' },
      { shouldFocus: true },
    );
  });

  it('leaves other errors to the caller', () => {
    const setError = vi.fn();
    expect(applyServerFieldErrors(new ApiError(500, 'INTERNAL_ERROR', 'Boom'), setError)).toBe(
      false,
    );
    expect(applyServerFieldErrors(new Error('x'), setError)).toBe(false);
    expect(
      applyServerFieldErrors(new ApiError(400, 'VALIDATION_ERROR', 'Bad', 'not a list'), setError),
    ).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
