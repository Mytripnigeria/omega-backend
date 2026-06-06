import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationCredentialEntity } from './entities/integration-credential.entity';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IntegrationCredentialEntity])],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
