// Updated collapsible.tsx
import React, { createContext, useContext, useState } from "react";

interface CollapsibleContextProps {
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
}

const CollapsibleContext = createContext<CollapsibleContextProps | undefined>(undefined);

interface CollapsibleProps {
  children: React.ReactNode;
  className?: string;
}

export const Collapsible: React.FC<CollapsibleProps> = ({ children, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <CollapsibleContext.Provider value={{ isOpen, setIsOpen }}>
      <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
  );
};

export const CollapsibleTrigger: React.FC<CollapsibleProps> = ({ children, className = "" }) => {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleTrigger must be used within a Collapsible");
  }

  const { isOpen, setIsOpen } = context;

  return (
    <button className={className} onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
      {children}
    </button>
  );
};

export const CollapsibleContent: React.FC<CollapsibleProps> = ({ children, className = "" }) => {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleContent must be used within a Collapsible");
  }

  const { isOpen } = context;

  if (!isOpen) return null;

  return <div className={className}>{children}</div>;
};
