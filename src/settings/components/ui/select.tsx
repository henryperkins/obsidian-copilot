// Updated select.tsx
import React, { createContext, useContext, useState } from "react";

interface SelectContextProps {
  value: string;
  onValueChange: (value: string) => void;
}

const SelectContext = createContext<SelectContextProps | undefined>(undefined);

interface SelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
}

export const Select: React.FC<SelectProps> = ({ children, value, onValueChange }) => (
  <SelectContext.Provider value={{ value, onValueChange }}>
    <div className="relative">{children}</div>
  </SelectContext.Provider>
);

interface SelectTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export const SelectTrigger: React.FC<SelectTriggerProps> = ({ children, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className={`flex h-10 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
};

interface SelectValueProps {
  placeholder?: string;
}

export const SelectValue: React.FC<SelectValueProps> = ({ placeholder = "" }) => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("SelectValue must be used within a Select");
  }

  const { value } = context;

  return <span>{value || placeholder}</span>;
};

interface SelectContentProps {
  children: React.ReactNode;
  className?: string;
}

export const SelectContent: React.FC<SelectContentProps> = ({ children, className = "" }) => (
  <div
    className={`relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ${className}`}
  >
    <div className="p-1">{children}</div>
  </div>
);

interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const SelectItem: React.FC<SelectItemProps> = ({ value, children, className = "" }) => {
  const context = useContext(SelectContext);
  if (!context) {
    throw new Error("SelectItem must be used within a Select");
  }

  const { onValueChange } = context;

  return (
    <div
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </div>
  );
};
