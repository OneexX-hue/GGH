import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QuestsService } from './quests.service';
import { QuestParticipationService } from './quest-participation.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { UpdateQuestDto } from './dto/update-quest.dto';
import { CreateCheckpointDto } from './dto/create-checkpoint.dto';
import { RedeemCheckpointDto } from './dto/redeem-checkpoint.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

// Порядок методов важен: статичные сегменты (active, checkpoints/:id/redeem)
// должны быть объявлены раньше динамического :id, иначе Nest резолвит их
// как GET /quests/:id с id="active" и т.п.
@Controller('quests')
export class QuestsController {
  constructor(
    private readonly questsService: QuestsService,
    private readonly participationService: QuestParticipationService,
  ) {}

  // --- Участник ---

  @Get('active')
  @UseGuards(JwtAuthGuard)
  listActive(@CurrentUser() user: AuthenticatedUser) {
    return this.participationService.listActive(user.userId);
  }

  @Post('checkpoints/:checkpointId/redeem')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  redeem(
    @Param('checkpointId') checkpointId: string,
    @Body() dto: RedeemCheckpointDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.participationService.redeem(checkpointId, user.userId, dto.code);
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
    return this.questsService.list();
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  create(@Body() dto: CreateQuestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.questsService.create(dto, user.userId, req.ip);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  getDetail(@Param('id') id: string) {
    return this.questsService.getDetail(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  update(@Param('id') id: string, @Body() dto: UpdateQuestDto, @CurrentUser() user: AuthenticatedUser, @Req() req: any) {
    return this.questsService.update(id, dto, user.userId, req.ip);
  }

  @Post(':id/checkpoints')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  addCheckpoint(
    @Param('id') id: string,
    @Body() dto: CreateCheckpointDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.questsService.addCheckpoint(id, dto, user.userId, req.ip);
  }

  @Post(':id/checkpoints/:checkpointId/regenerate-code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('modules.manage')
  regenerateCode(
    @Param('id') id: string,
    @Param('checkpointId') checkpointId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.questsService.regenerateCheckpointCode(id, checkpointId, user.userId, req.ip);
  }
}
