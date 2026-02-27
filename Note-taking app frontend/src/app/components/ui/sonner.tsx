import type { CSSProperties } from 'react';
import { Toaster as Sonner, ToasterProps } from "sonner";

// next-themes is not used in this app — pass theme directly to avoid
// an unmounted context hook that can cause "Invalid hook call" errors.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };