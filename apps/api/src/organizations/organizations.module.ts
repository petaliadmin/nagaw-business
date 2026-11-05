import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';
import { ProfileController } from './profile.controller.js';
import { ProfileService } from './profile.service.js';

@Module({
  controllers: [OrganizationsController, ProfileController],
  providers: [OrganizationsService, ProfileService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
