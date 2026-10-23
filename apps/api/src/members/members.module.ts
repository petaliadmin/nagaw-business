import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { InvitationsService } from './invitations.service.js';
import {
  InvitationAcceptanceController,
  MembersController,
} from './members.controller.js';
import { MembersService } from './members.service.js';

@Module({
  imports: [OrganizationsModule],
  controllers: [MembersController, InvitationAcceptanceController],
  providers: [MembersService, InvitationsService],
})
export class MembersModule {}
