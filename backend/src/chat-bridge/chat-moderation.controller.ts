import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ChatBridgeService, ModerationRoomType } from './chat-bridge.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

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
}
