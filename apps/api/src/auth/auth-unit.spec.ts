import { ForbiddenException, HttpException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { LoginThrottleService } from './login-throttle.service';
import { RolesGuard } from './guards/roles.guard';
import { ROLES_KEY } from './decorators/roles.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { escopoCliente, resolverResponsavel } from './escopo';

describe('LoginThrottleService', () => {
  it('bloqueia o e-mail após 5 falhas e libera após sucesso', () => {
    const t = new LoginThrottleService();
    for (let i = 0; i < 5; i++) t.registrarFalha('a@b.com', '1.1.1.1');
    expect(() => t.verificar('a@b.com', '9.9.9.9')).toThrow(HttpException);
    t.registrarSucesso('a@b.com');
    expect(() => t.verificar('a@b.com', '9.9.9.9')).not.toThrow();
  });

  it('bloqueia o IP após 20 falhas em e-mails diferentes', () => {
    const t = new LoginThrottleService();
    for (let i = 0; i < 20; i++) t.registrarFalha(`u${i}@b.com`, '2.2.2.2');
    expect(() => t.verificar('outro@b.com', '2.2.2.2')).toThrow(/Muitas tentativas/);
    expect(() => t.verificar('outro@b.com', '3.3.3.3')).not.toThrow();
  });
});

describe('RolesGuard', () => {
  function ctx(method: string, role: UserRole | null, meta: Record<string, unknown> = {}) {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: unknown) => meta[key as string]);
    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({
        getRequest: () => ({ method, user: role ? { id: 'u', email: 'e', nome: 'n', role } : undefined }),
      }),
    } as unknown as ExecutionContext;
    return { guard: new RolesGuard(reflector), context };
  }

  it('leitura sem @Roles é liberada pra qualquer autenticado', () => {
    const { guard, context } = ctx('GET', 'READONLY');
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each<UserRole>(['READONLY', 'COMPLIANCE'])('escrita sem @Roles é negada para %s (default seguro)', (role) => {
    const { guard, context } = ctx('POST', role);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it.each<UserRole>(['ADMIN', 'ASSESSOR'])('escrita sem @Roles é permitida para %s', (role) => {
    const { guard, context } = ctx('PATCH', role);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('@Roles("ADMIN") barra ASSESSOR com mensagem em pt-BR', () => {
    const { guard, context } = ctx('DELETE', 'ASSESSOR', { [ROLES_KEY]: ['ADMIN'] });
    expect(() => guard.canActivate(context)).toThrow(/Assessor.*não tem permissão/);
  });

  it('rota pública passa sem usuário', () => {
    const { guard, context } = ctx('POST', null, { [IS_PUBLIC_KEY]: true });
    expect(guard.canActivate(context)).toBe(true);
  });
});

describe('escopo de dados', () => {
  const user = (role: UserRole) => ({ id: 'u1', email: 'e', nome: 'n', role });

  it('assessor só enxerga a própria carteira', () => {
    expect(escopoCliente(user('ASSESSOR'))).toEqual({ responsavelId: 'u1' });
  });

  it.each<UserRole>(['ADMIN', 'COMPLIANCE', 'READONLY'])('%s enxerga a base toda', (role) => {
    expect(escopoCliente(user(role))).toEqual({});
  });

  it('assessor não pode atribuir cliente a outra pessoa; admin pode', () => {
    expect(resolverResponsavel(user('ASSESSOR'))).toBe('u1');
    expect(resolverResponsavel(user('ASSESSOR'), 'u1')).toBe('u1');
    expect(() => resolverResponsavel(user('ASSESSOR'), 'u2')).toThrow(ForbiddenException);
    expect(resolverResponsavel(user('ADMIN'), 'u2')).toBe('u2');
  });
});
