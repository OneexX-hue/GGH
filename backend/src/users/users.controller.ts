import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { RegisterPushTokenDto } from '../push/dto/register-push-token.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.userId);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('me/vehicles')
  addVehicle(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVehicleDto) {
    return this.usersService.addVehicle(user.userId, dto);
  }

  @Get('me/vehicles')
  myVehicles(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listVehicles(user.userId);
  }

  @Post('me/push-token')
  registerPushToken(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPushTokenDto) {
    return this.usersService.registerPushToken(user.userId, dto.token);
  }

  // Доступен любому авторизованному участнику (без users.manage) — нужен,
  // чтобы начать чат с другим участником клуба.
  @Get('directory')
  directory() {
    return this.usersService.directory();
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermission('users.manage')
  list(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.usersService.list({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Post(':id/ban')
  @UseGuards(PermissionsGuard)
  @RequirePermission('users.manage')
  ban(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.usersService.ban(id, user.userId, req.ip);
  }

  @Post(':id/unban')
  @UseGuards(PermissionsGuard)
  @RequirePermission('users.manage')
  unban(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.usersService.unban(id, user.userId, req.ip);
  }
}
