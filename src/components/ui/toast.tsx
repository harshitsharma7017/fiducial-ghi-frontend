'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { XIcon } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import type * as React from 'react';
import { dismissToast, useToasts } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-md border p-4 pr-8 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-full',
  {
    variants: {
      variant: {
        default: 'border bg-card text-card-foreground',
        success: 'border-success/30 bg-success-soft text-foreground',
        destructive: 'border-destructive/30 bg-destructive-soft text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Toast({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> & VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
}

function ToastTitle({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return <ToastPrimitive.Title className={cn('text-sm font-semibold', className)} {...props} />;
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      className={cn('text-sm text-foreground/80', className)}
      {...props}
    />
  );
}

function ToastClose({ className, ...props }: React.ComponentProps<typeof ToastPrimitive.Close>) {
  return (
    <ToastPrimitive.Close
      className={cn(
        'absolute top-2 right-2 rounded-sm p-1 opacity-70 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
      aria-label="Dismiss"
      {...props}
    >
      <XIcon className="size-4" aria-hidden="true" />
    </ToastPrimitive.Close>
  );
}

/** Renders queued toasts. Mount once, inside the app providers. */
function Toaster() {
  const toasts = useToasts();
  return (
    <ToastPrimitive.Provider duration={5000} swipeDirection="right">
      {toasts.map((item) => (
        <Toast
          key={item.id}
          variant={item.variant}
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id);
          }}
        >
          <div className="grid gap-1">
            <ToastTitle>{item.title}</ToastTitle>
            {item.description ? <ToastDescription>{item.description}</ToastDescription> : null}
          </div>
          <ToastClose />
        </Toast>
      ))}
      <ToastPrimitive.Viewport className="fixed right-0 bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 outline-none sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}

export { Toast, ToastClose, ToastDescription, ToastTitle, Toaster };
