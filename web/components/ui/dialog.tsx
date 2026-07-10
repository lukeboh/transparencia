'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Modal sobre o elemento nativo <dialog> (foco, Esc e inert do fundo por conta
 * do navegador). Clique no backdrop fecha.
 */
function Dialog({ open, onClose, children, className }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] max-w-2xl rounded-lg border border-border bg-popover p-0 text-popover-foreground shadow-lg',
        'backdrop:bg-black/60 backdrop:backdrop-blur-[2px]',
        className,
      )}
    >
      {children}
    </dialog>
  );
}

function DialogHeader({
  titulo,
  descricao,
  onClose,
}: {
  titulo: string;
  descricao?: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border p-4">
      <div>
        <h2 className="text-base font-semibold">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export { Dialog, DialogHeader };
