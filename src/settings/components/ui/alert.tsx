// Updated alert.tsx
import React from "react";

interface AlertProps {
  className?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({ className = "", children }) => (
  <div className={`relative w-full rounded-lg border p-4 ${className}`} role="alert">
    {children}
  </div>
);

interface AlertDescriptionProps {
  className?: string;
  children: React.ReactNode;
}

export const AlertDescription: React.FC<AlertDescriptionProps> = ({ className = "", children }) => (
  <div className={`text-sm [&_p]:leading-relaxed ${className}`}>{children}</div>
);
