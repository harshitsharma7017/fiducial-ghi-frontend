'use client';

import { useSyncExternalStore } from 'react';

/** A small toast store, following the shadcn/ui toast pattern. */

export type ToastVariant = 'default' | 'success' | 'destructive';

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const LIMIT = 3;
let toasts: ToastMessage[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(message: {
  title: string;
  description?: string;
  variant?: ToastVariant;
}): number {
  const id = nextId++;
  const item: ToastMessage = {
    id,
    title: message.title,
    description: message.description,
    variant: message.variant ?? 'default',
  };
  toasts = [item, ...toasts].slice(0, LIMIT);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

const EMPTY: ToastMessage[] = [];

export function useToasts(): ToastMessage[] {
  return useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
}
