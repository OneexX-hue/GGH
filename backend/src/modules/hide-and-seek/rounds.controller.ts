import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RoundsService } from './rounds.service';
import { RoundParticipationService } from './round-participation.service';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';
import { FindRoundDto } from './dto/find-round.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Порядок методов важен: статичные сегменты (active, :roundId/find) должны
// быть объявлены раньше динамического :id, иначе Nest резолвит их как
// GET /hide-and-seek/rounds/:id с id="active" и т.п.
@Controller('hide-and-seek/rounds')
export class RoundsController {
  constructor(
    private readonly roundsService: RoundsService,
    private readonly participationService: RoundParticipationService,
  ) {}

  // --- Участник ---

  @Get('active')
  @UseGuards(JwtAuthGuard)
  listActive(@CurrentUser() user: AuthenticatedUser) {
    return this.participationService.listActive(user.userId);
  }

  @Post(':roundId/find')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  find(@Param('roundId') roundId: string, @Body() dto: FindRoundDto, @CurrentUser() user: AuthenticatedUser) {
    return this.participationService.find(roundId, user.userId, dto.code);
  }

  @Get(':id/leaderboard')
  @UseGuards(JwtAuthGuard)
  leaderboard(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.participationService.leaderboard(id, limit ? Number(limit) : undefined);
  }

  // --- Администрирование (modules.manage) ---

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  list() {
    return this.roundsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  create(@Body() dto: CreateRoundDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.roundsService.create(dto, user.userId, req.ip);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  getDetail(@Param('id') id: string) {
    return this.roundsService.getDetail(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRoundDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.roundsService.update(id, dto, user.userId, req.ip);
  }

  @Post(':id/regenerate-code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  regenerateCode(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.roundsService.regenerateCode(id, user.userId, req.ip);
  }
}
