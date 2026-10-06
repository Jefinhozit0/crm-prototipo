import { cpfValido, hashCpf, hashCpfLegado, maskCpf } from './cpf';
import { clienteCreateSchema, clienteUpdateSchema } from './dto/cliente.schemas';

describe('CPF', () => {
  it.each(['52998224725', '11144477735', '39053344705'])('aceita CPF válido %s', (cpf) => {
    expect(cpfValido(cpf)).toBe(true);
  });

  it.each([
    ['52998224724', 'dígito verificador errado'],
    ['11111111111', 'sequência repetida'],
    ['1234567890', '10 dígitos'],
    ['5299822472a', 'não numérico'],
  ])('rejeita %s (%s)', (cpf) => {
    expect(cpfValido(cpf)).toBe(false);
  });

  it('hash é HMAC com prefixo de versão, determinístico e dependente do segredo', () => {
    const a = hashCpf('52998224725', 'segredo-a');
    expect(a).toMatch(/^h1:[0-9a-f]{64}$/);
    expect(hashCpf('52998224725', 'segredo-a')).toBe(a);
    expect(hashCpf('52998224725', 'segredo-b')).not.toBe(a);
    expect(a).not.toContain('52998224725');
  });

  it('formato legado (sha256 puro) continua calculável pra detectar duplicata', () => {
    expect(hashCpfLegado('52998224725')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('máscara expõe só os 5 últimos dígitos', () => {
    expect(maskCpf('52998224725')).toBe('***.***.247-25');
  });
});

describe('schemas de cliente', () => {
  const base = { nome: 'Ana Souza', email: 'ANA@Exemplo.com ', cpf: '529.982.247-25' };

  it('normaliza CPF formatado e e-mail', () => {
    const r = clienteCreateSchema.parse(base);
    expect(r.cpf).toBe('52998224725');
    expect(r.email).toBe('ana@exemplo.com');
    expect(r.perfil).toBe('MODERADO');
  });

  it('rejeita CPF com dígito verificador inválido', () => {
    expect(clienteCreateSchema.safeParse({ ...base, cpf: '529.982.247-24' }).success).toBe(false);
  });

  it('rejeita patrimônio negativo', () => {
    expect(clienteCreateSchema.safeParse({ ...base, patrimonio: -1 }).success).toBe(false);
  });

  it('update não aceita CPF nem perfil (perfil só muda via suitability)', () => {
    expect(clienteUpdateSchema.safeParse({ perfil: 'AGRESSIVO' }).success).toBe(false);
    expect(clienteUpdateSchema.safeParse({ cpf: '52998224725' }).success).toBe(false);
    expect(clienteUpdateSchema.safeParse({}).success).toBe(false);
    expect(clienteUpdateSchema.safeParse({ cidade: 'Recife' }).success).toBe(true);
  });
});
