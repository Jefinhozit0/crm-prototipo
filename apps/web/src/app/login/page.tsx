"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertCircle, Briefcase, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useLogin } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

type LoginInputs = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginInputs) {
    setServerError(null);
    try {
      await login.mutateAsync(values);
      const from = params.get("from") || "/dashboard";
      router.replace(from);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Erro inesperado";
      setServerError(msg);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-sm mb-3">
            <Briefcase className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Capital Elite</h1>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.14em] mt-0.5">
            Wealth Management
          </p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h2 className="font-semibold tracking-tight">Acesse sua conta</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Use suas credenciais corporativas
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@capitalelite.com.br"
                  className={cn(errors.email && "border-destructive")}
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={cn(errors.password && "border-destructive")}
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {serverError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Entrar
              </Button>
            </form>

            <div className="text-center pt-1">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  alert("Fluxo de recuperação será adicionado em fase futura.")
                }
              >
                Esqueci minha senha
              </button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Dev: <code className="font-mono">admin@capitalelite.com.br</code> /{" "}
          <code className="font-mono">Senha123!</code>
        </p>
      </div>
    </div>
  );
}
