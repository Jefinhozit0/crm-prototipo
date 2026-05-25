"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/query-states";
import { RecomendacaoCard } from "@/components/recomendacao-card";
import { useRecomendacao } from "@/lib/queries";

type Props = {
  recomendacaoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RecomendacaoDetalheDialog({ recomendacaoId, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useRecomendacao(open ? recomendacaoId : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sr-only">
          <DialogTitle>Detalhes da recomendação</DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 p-1">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && <ErrorState message={error.message} />}

        {data && (
          <RecomendacaoCard
            recomendacao={data}
            onActionDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
