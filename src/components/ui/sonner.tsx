"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * App toast surface (sonner). Mounted once per layout; trigger toasts with
 * `toast.error(...)` / `toast.success(...)` from "sonner".
 *
 * `richColors` gives semantic success/error styling out of the box, which keeps
 * the auth error toasts readable without bespoke styling.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl border shadow-lg",
          description: "text-sm",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
