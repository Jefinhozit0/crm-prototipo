import { createHash, createHmac } from 'node:crypto';

/** Valida CPF (11 dígitos + dígitos verificadores; rejeita sequências repetidas). */
export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(cpf.slice(0, 9), 10);
  const d2 = dv(cpf.slice(0, 10), 11);
  return d1 === Number(cpf[9]) && d2 === Number(cpf[10]);
}

/**
 * Hash do CPF pra unicidade sem guardar o número.
 *
 * HMAC-SHA256 com segredo (CPF_HASH_SECRET): SHA-256 puro de CPF é revertível
 * por força bruta (só ~10^9 combinações). Prefixo "h1:" distingue do formato
 * legado (sha256 puro, 64 hex) ainda presente em registros antigos.
 */
export function hashCpf(cpf: string, segredo: string): string {
  return 'h1:' + createHmac('sha256', segredo).update(cpf).digest('hex');
}

/** Formato legado — usado só pra detectar duplicata contra registros antigos. */
export function hashCpfLegado(cpf: string): string {
  return createHash('sha256').update(cpf).digest('hex');
}

export function maskCpf(cpf: string): string {
  return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}
