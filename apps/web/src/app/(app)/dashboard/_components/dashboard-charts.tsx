"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DemoBadge } from "@/components/demo";
import { fmt } from "@/lib/format";

type Props = {
  aumSerie: { mes: string; aum: number }[];
  captacaoSerie: { mes: string; entrada: number; saida: number }[];
  /** null enquanto carrega */
  distribuicaoPerfil: { perfil: string; quantidade: number; pct: number }[] | null;
};

const PERFIL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e"];
const NAVY = "#1e40af";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";

// Evita o aviso "width(-1)" no prerender (o container ainda não tem tamanho)
const DIM_INICIAL = { width: 320, height: 200 };

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

export function DashboardCharts({ aumSerie, captacaoSerie, distribuicaoPerfil }: Props) {
  const semClientes = distribuicaoPerfil?.every((p) => p.quantidade === 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Evolução de AUM</CardTitle>
            <DemoBadge />
          </div>
          <CardDescription>
            Em R$ milhões — histórico mensal ainda não é registrado pelo sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64" role="img" aria-label="Gráfico demonstrativo de evolução de AUM">
            <ResponsiveContainer width="100%" height="100%" initialDimension={DIM_INICIAL}>
              <AreaChart data={aumSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gAum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`R$ ${String(v)} mi`, "AUM"]} />
                <Area type="monotone" dataKey="aum" stroke={NAVY} strokeWidth={2.5} fill="url(#gAum)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por perfil</CardTitle>
          <CardDescription>Clientes ativos e prospectos</CardDescription>
        </CardHeader>
        <CardContent>
          {!distribuicaoPerfil ? (
            <Skeleton className="h-64 w-full" />
          ) : semClientes ? (
            <p className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Nenhum cliente na sua carteira ainda.
            </p>
          ) : (
            <>
              <div className="h-64" role="img" aria-label="Distribuição de clientes por perfil de investidor">
                <ResponsiveContainer width="100%" height="100%" initialDimension={DIM_INICIAL}>
                  <PieChart>
                    <Pie
                      data={distribuicaoPerfil}
                      dataKey="quantidade"
                      nameKey="perfil"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {distribuicaoPerfil.map((_, i) => (
                        <Cell key={i} fill={PERFIL_COLORS[i % PERFIL_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [`${String(v)} cliente(s)`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-2 space-y-1">
                {distribuicaoPerfil.map((p, i) => (
                  <li key={p.perfil} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PERFIL_COLORS[i % PERFIL_COLORS.length] }}
                        aria-hidden
                      />
                      {p.perfil}
                    </span>
                    <span className="font-medium tabular-nums">
                      {p.quantidade} · {fmt.pct(p.pct)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>Captação líquida</CardTitle>
            <DemoBadge />
          </div>
          <CardDescription>
            Entradas vs. resgates — em R$ milhões (movimentações ainda não são registradas)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56" role="img" aria-label="Gráfico demonstrativo de captação líquida">
            <ResponsiveContainer width="100%" height="100%" initialDimension={DIM_INICIAL}>
              <BarChart data={captacaoSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`R$ ${String(v)} mi`, ""]}
                  cursor={{ fill: "rgba(15,23,42,0.04)" }}
                />
                <Bar dataKey="entrada" name="Entradas" fill={EMERALD} radius={[6, 6, 0, 0]} />
                <Bar dataKey="saida" name="Saídas" fill={ROSE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
