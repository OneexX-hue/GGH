import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  @RequirePermission('roles.manage')
  list() {
    return this.rolesService.list();
  }

  @Get('permissions')
  @RequirePermission('roles.manage')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Post('roles')
  @RequirePermission('roles.manage')
  create(@Body() dto: CreateRoleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.rolesService.create(dto, user.userId, req.ip);
  }

  @Post('roles/:id/assign')
  @RequirePermission('roles.manage')
  assign(
    @Param('id') roleId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.rolesService.assign(roleId, dto.userId, user.userId, req.ip);
  }

  @Post('roles/:id/unassign')
  @RequirePermission('roles.manage')
  unassign(
    @Param('id') roleId: string,
    @Body() dto: AssignRoleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.rolesService.unassign(roleId, dto.userId, user.userId, req.ip);
  }
}
