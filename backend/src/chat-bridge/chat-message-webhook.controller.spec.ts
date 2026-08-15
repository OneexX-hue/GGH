import { ForbiddenException } from '@nestjs/common';
import { ChatMessageWebhookController } from './chat-message-webhook.controller';
import { rocketChatUsernameFor } from './rocketchat-username.util';

function makeController(overrides: { secret?: string; prisma?: any } = {}) {
  const config = { get: jest.fn(() => overrides.secret ?? 'webhook-secret') };
  const chatBridge = { getRoomInfo: jest.fn() };
  const prisma = overrides.prisma ?? { user: { findFirst: jest.fn() } };
  const push = { sendToUser: jest.fn().mockResolvedValue(undefined) };
  const controller = new ChatMessageWebhookController(chatBridge as any, prisma as any, push as any, config as any);
  return { controller, chatBridge, prisma, push };
}

describe('ChatMessageWebhookController', () => {
  it('отклоняет запрос с неверным секретом', async () => {
    const { controller } = makeController({ secret: 'correct-secret' });

    await expect(
      controller.onMessage({ token: 'wrong', channel_id: 'room-1', user_name: 'carclub_aaaaaaaa' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('пропускает push для не-личных комнат (roomType != d)', async () => {
    const { controller, chatBridge, push } = makeController();
    chatBridge.getRoomInfo.mockResolvedValue({ t: 'c' });

    const result = await controller.onMessage({
      token: 'webhook-secret',
      channel_id: 'room-1',
      user_name: 'carclub_aaaaaaaa',
    });

    expect(result).toEqual({ success: true });
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('шлёт push всем участникам личной комнаты кроме отправителя', async () => {
    const senderUsername = rocketChatUsernameFor('sender-userid-11111');
    const recipientUserId = 'recipient-userid-22222';
    const recipientUsername = rocketChatUsernameFor(recipientUserId);

    const prisma = { user: { findFirst: jest.fn().mockResolvedValue({ id: recipientUserId }) } };
    const { controller, chatBridge, push } = makeController({ prisma });
    chatBridge.getRoomInfo.mockResolvedValue({ t: 'd', usernames: [senderUsername, recipientUsername] });

    await controller.onMessage({ token: 'webhook-secret', channel_id: 'room-1', user_name: senderUsername });

    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith(recipientUserId, 'Новое сообщение', 'У вас новое сообщение в чате');
  });

  it('не шлёт push самому отправителю', async () => {
    const senderUsername = rocketChatUsernameFor('sender-userid-11111');
    const { controller, chatBridge, push } = makeController();
    chatBridge.getRoomInfo.mockResolvedValue({ t: 'd', usernames: [senderUsername] });

    await controller.onMessage({ token: 'webhook-secret', channel_id: 'room-1', user_name: senderUsername });

    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('пропускает участника, если его не удалось резолвить в нашего пользователя', async () => {
    const prisma = { user: { findFirst: jest.fn().mockResolvedValue(null) } };
    const { controller, chatBridge, push } = makeController({ prisma });
    chatBridge.getRoomInfo.mockResolvedValue({ t: 'd', usernames: ['sender', 'carclub_ffffffff'] });

    await controller.onMessage({ token: 'webhook-secret', channel_id: 'room-1', user_name: 'sender' });

    expect(push.sendToUser).not.toHaveBeenCalled();
  });
});
