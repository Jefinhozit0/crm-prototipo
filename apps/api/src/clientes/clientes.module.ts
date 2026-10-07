import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  controllers: [ClientesController],
  providers: [ClientesService],
  // LeadsService usa criarEm() na conversão lead → cliente
  exports: [ClientesService],
})
export class ClientesModule {}
