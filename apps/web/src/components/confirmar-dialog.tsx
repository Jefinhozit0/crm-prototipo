"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Confirmação de ação sensível (inativar, excluir). Fica aberto até a ação terminar. */
export function ConfirmarDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  confirmar,
  onConfirmar,
  pendente,
  destrutivo = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  confirmar: string;
  onConfirmar: () => void;
  pendente?: boolean;
  destrutivo?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !pendente && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendente}>
            Cancelar
          </Button>
          <Button variant={destrutivo ? "destructive" : "default"} onClick={onConfirmar} disabled={pendente}>
            {pendente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
