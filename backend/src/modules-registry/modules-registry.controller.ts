import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ModulesRegistryService } from './modules-registry.service';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('modules')
export class ModulesRegistryController {
  constructor(private readonly modulesRegistryService: ModulesRegistryService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  list() {
    return this.modulesRegistryService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  register(@Body() dto: CreateModuleDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.modulesRegistryService.register(dto, user.userId, req.ip);
  }

  @Patch(':key')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateModuleDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.modulesRegistryService.update(key, dto, user.userId, req.ip);
  }

  // Статичный сегмент раньше динамического :key, иначе Nest резолвит это
  // как GET /modules/:key/leaderboard с key="leaderboard" (см. тот же
  // приём в quests.controller.ts). Виден всем авторизованным участникам.
  @Get('leaderboard/overall')
  @UseGuards(JwtAuthGuard)
  overallLeaderboard(@Query('limit') limit?: string) {
    return this.modulesRegistryService.overallLeaderboard(limit ? Number(limit) : undefined);
  }

  /** Кросс-модульная лента последних событий (баллы всех модулей сразу). */
  @Get('feed/recent')
  @UseGuards(JwtAuthGuard)
  recentFeed(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.modulesRegistryService.recentFeed({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  // Лидерборд по модулю виден всем авторизованным участникам, не только
  // модераторам/админам — не за @RequirePermission('modules.manage').
  @Get(':key/leaderboard')
  @UseGuards(JwtAuthGuard)
  leaderboard(@Param('key') key: string, @Query('limit') limit?: string) {
    return this.modulesRegistryService.leaderboard(key, limit ? Number(limit) : undefined);
  }
}
