import { Construction, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  icon?: LucideIcon;
  message?: string;
  bullets?: string[];
};

export function RoutePlaceholder({
  icon: Icon = Construction,
  message = "Esta tela faz parte do escopo do MVP — aguardando integração com o backend.",
  bullets,
}: Props) {
  return (
    <Card>
      <CardContent className="py-16 flex flex-col items-center text-center gap-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-muted-foreground max-w-md">{message}</p>
        {bullets && bullets.length > 0 && (
          <ul className="text-sm text-muted-foreground/80 list-disc text-left mt-2 space-y-1">
            {bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
