import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ChatBridgeService, ModerationRoomType } from './chat-bridge.service';
import { BanSenderDto } from './dto/ban-sender.dto';
import { MuteSenderDto } from './dto/mute-sender.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Controller('moderation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('chat.moderate')
export class ChatModerationController {
  constructor(private readonly chatBridgeService: ChatBridgeService) {}

  @Get('rooms')
  listRooms(@Query('count') count?: string, @Query('offset') offset?: string) {
    return this.chatBridgeService.listRooms({
      count: count ? Number(count) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('rooms/:roomId/messages')
  getRoomHistory(@Param('roomId') roomId: string, @Query('roomType') roomType: ModerationRoomType) {
    return this.chatBridgeService.getRoomHistory(roomId, roomType);
  }

  @Delete('rooms/:roomId/messages/:msgId')
  async deleteMessage(@Param('roomId') roomId: string, @Param('msgId') msgId: string) {
    await this.chatBridgeService.deleteMessage(roomId, msgId);
    return { success: true };
  }

  /**
   * Бан «отправителя этого сообщения» без раскрытия оператору реального
   * имени — Rocket.Chat уже показывает псевдоним, не имя (см.
   * docs/DECISIONS.md), клиент передаёт только RC id из уже загруженной
   * истории сообщений.
   */
  @Post('rooms/:roomId/messages/:msgId/ban-sender')
  async banSender(
    @Param('roomId') roomId: string,
    @Param('msgId') msgId: string,
    @Body() dto: BanSenderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    await this.chatBridgeService.banSenderOfMessage(dto.rocketChatUserId, user.userId, { roomId, msgId }, req.ip);
    return { success: true };
  }

  /** Временный мут по комнате (группа/канал) — см. ChatBridgeService.muteUserInRoom. */
  @Post('rooms/:roomId/mute')
  async muteSender(
    @Param('roomId') roomId: string,
    @Query('roomType') roomType: ModerationRoomType,
    @Body() dto: MuteSenderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    await this.chatBridgeService.muteUserInRoom(roomId, roomType, dto.username, user.userId, req.ip);
    return { success: true };
  }

  @Post('rooms/:roomId/unmute')
  async unmuteSender(
    @Param('roomId') roomId: string,
    @Query('roomType') roomType: ModerationRoomType,
    @Body() dto: MuteSenderDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    await this.chatBridgeService.unmuteUserInRoom(roomId, roomType, dto.username, user.userId, req.ip);
    return { success: true };
  }

  @Get('reports')
  listReports(@Query('status') status?: 'OPEN' | 'RESOLVED' | 'DISMISSED') {
    return this.chatBridgeService.listReports(status);
  }

  @Post('reports/:id/resolve')
  async resolveReport(
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: any,
  ) {
    return this.chatBridgeService.resolveReport(id, dto.status, user.userId, req.ip);
  }
}
