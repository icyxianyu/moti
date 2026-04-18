"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "#141416",
            border: "1px solid #2A2A2E",
            color: "#E4E4E7",
          },
        }}
      />
    </SessionProvider>
  );
}
