import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [MeController],
})
export class MeModule {}
