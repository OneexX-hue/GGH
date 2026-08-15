import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApplicationStatus } from '@prisma/client';
import { InvitesService } from './invites.service';
import { ApplicationsService } from './applications.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller()
export class InvitesController {
  constructor(
    private readonly invitesService: InvitesService,
    private readonly applicationsService: ApplicationsService,
  ) {}

  @Post('invites')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invites.create')
  createInvite(@Body() dto: CreateInviteDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.invitesService.create(user.userId, dto, req.ip);
  }

  @Get('invites')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invites.create')
  listInvites() {
    return this.invitesService.list();
  }

  @Post('invites/:id/revoke')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('invites.revoke')
  revokeInvite(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.invitesService.revoke(id, user.userId, req.ip);
  }

  // Публичная подача заявки на вступление без инвайт-кода (ТЗ гл. 2.1) — без auth.
  @Post('applications')
  submitApplication(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.submit(dto);
  }

  @Get('applications')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('applications.review')
  listApplications(@Query('status') status?: ApplicationStatus) {
    return this.applicationsService.list(status);
  }

  @Post('applications/:id/review')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('applications.review')
  reviewApplication(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.applicationsService.review(id, user.userId, dto.decision, req.ip);
  }
}
