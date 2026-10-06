import { AlertCircle, Inbox, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Card role="alert">
      <CardContent className="py-12 flex flex-col items-center text-center gap-3">
        <div className="h-10 w-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <AlertCircle className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <p className="font-medium text-sm">Não foi possível carregar os dados</p>
          <p className="text-xs text-muted-foreground mt-1">
            {message ?? "Tente novamente em instantes."}
          </p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center gap-3">
        <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
          <Inbox className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-56 w-full" />
      ))}
    </div>
  );
}
