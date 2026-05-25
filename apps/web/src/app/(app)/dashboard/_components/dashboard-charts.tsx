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

type Props = {
  aumSerie: { mes: string; aum: number }[];
  captacaoSerie: { mes: string; entrada: number; saida: number }[];
  distribuicaoPerfil: { perfil: string; pct: number }[];
};

const PERFIL_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f43f5e"];
const NAVY = "#1e40af";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";

export function DashboardCharts({ aumSerie, captacaoSerie, distribuicaoPerfil }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Evolução de AUM</CardTitle>
          <CardDescription>Em R$ milhões — últimos 6 meses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
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
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                  }}
                  formatter={(v) => [`R$ ${String(v)}M`, "AUM"]}
                />
                <Area
                  type="monotone"
                  dataKey="aum"
                  stroke={NAVY}
                  strokeWidth={2.5}
                  fill="url(#gAum)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por perfil</CardTitle>
          <CardDescription>% de clientes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribuicaoPerfil}
                  dataKey="pct"
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
                <Tooltip formatter={(v) => [`${String(v)}%`, ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1">
            {distribuicaoPerfil.map((p, i) => (
              <li
                key={p.perfil}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PERFIL_COLORS[i % PERFIL_COLORS.length] }}
                  />
                  {p.perfil}
                </span>
                <span className="font-medium">{p.pct}%</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Captação líquida</CardTitle>
          <CardDescription>Entradas vs. resgates — em R$ milhões</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={captacaoSerie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.06)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
                  }}
                  formatter={(v) => [`R$ ${String(v)}M`, ""]}
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
