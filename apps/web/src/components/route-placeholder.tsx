import { Construction, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DemoBadge } from "@/components/demo";

type Props = {
  icon?: LucideIcon;
  message?: string;
  bullets?: string[];
};

/** Tela de funcionalidade planejada — deixa explícito que nada aqui está operando. */
export function RoutePlaceholder({
  icon: Icon = Construction,
  message = "Esta funcionalidade está planejada e ainda não foi implementada.",
  bullets,
}: Props) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center gap-4">
        <DemoBadge texto="Funcionalidade futura" />
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        {bullets && bullets.length > 0 && (
          <div className="text-left">
            <p className="text-xs font-medium text-muted-foreground mb-1">Escopo previsto:</p>
            <ul className="text-sm text-muted-foreground/90 list-disc pl-5 space-y-1">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
