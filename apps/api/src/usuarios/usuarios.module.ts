import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Assessores ativos — opções de responsável ao cadastrar cliente/lead */
  assessores() {
    return this.prisma.user.findMany({
      where: { role: 'ASSESSOR', ativo: true },
      select: { id: true, nome: true, email: true },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
  }
}

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  // Só quem pode atribuir carteira a outra pessoa precisa da lista
  @Get('assessores')
  @Roles('ADMIN')
  assessores() {
    return this.service.assessores();
  }
}

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule {}
