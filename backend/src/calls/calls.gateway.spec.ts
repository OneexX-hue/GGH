import { CallsGateway } from './calls.gateway';

function fakeSocket() {
  return { send: jest.fn(), close: jest.fn() } as any;
}

describe('CallsGateway', () => {
  let jwt: any;
  let config: any;
  let callsHistory: any;
  let presence: any;
  let gateway: CallsGateway;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    config = { get: jest.fn().mockReturnValue('test-secret') };
    callsHistory = { record: jest.fn().mockResolvedValue(undefined) };
    // По умолчанию Valkey не настроен (enabled: false) — тот же
    // single-instance путь, что и раньше в этих тестах. Отдельная группа
    // тестов ниже явно проверяет multi-instance-путь (enabled: true).
    presence = {
      enabled: false,
      markOnline: jest.fn().mockResolvedValue(undefined),
      markOffline: jest.fn().mockResolvedValue(undefined),
      isOnlineAnywhere: jest.fn().mockResolvedValue(false),
      publishRelay: jest.fn().mockResolvedValue(undefined),
      setOnRelayMessage: jest.fn(),
    };
    gateway = new CallsGateway(jwt, config, callsHistory, presence);
  });

  function connectUser(userId: string) {
    const socket = fakeSocket();
    jwt.verify.mockReturnValueOnce({ sub: userId });
    gateway.handleConnection(socket, { url: '/calls?token=valid-token' } as any);
    return socket;
  }

  it('закрывает соединение без токена', () => {
    const socket = fakeSocket();
    gateway.handleConnection(socket, { url: '/calls' } as any);
    expect(socket.close).toHaveBeenCalledWith(4401, 'Требуется токен');
  });

  it('закрывает соединение с невалидным токеном', () => {
    const socket = fakeSocket();
    jwt.verify.mockImplementationOnce(() => {
      throw new Error('bad token');
    });
    gateway.handleConnection(socket, { url: '/calls?token=garbage' } as any);
    expect(socket.close).toHaveBeenCalledWith(4401, 'Недействительный токен');
  });

  it('отклоняет refresh-токен', () => {
    const socket = fakeSocket();
    jwt.verify.mockReturnValueOnce({ sub: 'user-1', type: 'refresh' });
    gateway.handleConnection(socket, { url: '/calls?token=refresh-token' } as any);
    expect(socket.close).toHaveBeenCalledWith(4401, 'Недействительный токен');
  });

  it('call-user пересылает incoming-call онлайн-получателю', async () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    await gateway.onCallUser(a, { to: 'user-b', callId: 'call-1', kind: 'video' });

    expect(b.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'incoming-call', data: { from: 'user-a', callId: 'call-1', kind: 'video' } }),
    );
    expect(a.send).not.toHaveBeenCalled();
  });

  it('call-user отвечает call-failed, если получатель не в сети', async () => {
    const a = connectUser('user-a');

    await gateway.onCallUser(a, { to: 'user-offline', callId: 'call-2', kind: 'audio' });

    expect(a.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'call-failed', data: { callId: 'call-2', reason: 'user-offline' } }),
    );
  });

  it('offer/answer/ice-candidate релеятся с полем from от сервера, не от клиента', async () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    await gateway.onOffer(a, { to: 'user-b', callId: 'call-1', sdp: { type: 'offer', sdp: 'x' } });
    expect(b.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'offer', data: { from: 'user-a', callId: 'call-1', sdp: { type: 'offer', sdp: 'x' } } }),
    );

    await gateway.onAnswer(b, { to: 'user-a', callId: 'call-1', sdp: { type: 'answer', sdp: 'y' } });
    expect(a.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'answer', data: { from: 'user-b', callId: 'call-1', sdp: { type: 'answer', sdp: 'y' } } }),
    );

    await gateway.onIceCandidate(a, { to: 'user-b', callId: 'call-1', candidate: { c: 1 } });
    expect(b.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'ice-candidate', data: { from: 'user-a', callId: 'call-1', candidate: { c: 1 } } }),
    );
  });

  it('после disconnect пользователь больше не получает сигналы (удалён из presence)', async () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    gateway.handleDisconnect(b);
    await gateway.onCallUser(a, { to: 'user-b', callId: 'call-3', kind: 'audio' });

    expect(b.send).not.toHaveBeenCalled();
    expect(a.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'call-failed', data: { callId: 'call-3', reason: 'user-offline' } }),
    );
  });

  it('disconnect не удаляет более нового сокета того же пользователя (переподключение)', async () => {
    const first = connectUser('user-a');
    const second = connectUser('user-a'); // тот же userId переподключился новым сокетом

    gateway.handleDisconnect(first); // старый сокет отключился уже после переподключения

    const other = connectUser('user-b');
    await gateway.onCallUser(other, { to: 'user-a', callId: 'call-4', kind: 'audio' });

    expect(second.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'incoming-call', data: { from: 'user-b', callId: 'call-4', kind: 'audio' } }),
    );
  });

  it('call-user + call-failed (получатель офлайн) сразу пишет FAILED в историю', async () => {
    const a = connectUser('user-a');

    await gateway.onCallUser(a, { to: 'user-offline', callId: 'call-history-1', kind: 'audio' });

    expect(callsHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ callerId: 'user-a', calleeId: 'user-offline', kind: 'AUDIO', status: 'FAILED' }),
    );
  });

  it('call-user → end-call без accept-call пишет MISSED (звонок не был принят)', async () => {
    const a = connectUser('user-a');
    connectUser('user-b');

    await gateway.onCallUser(a, { to: 'user-b', callId: 'call-history-2', kind: 'video' });
    await gateway.onEndCall(a, { to: 'user-b', callId: 'call-history-2' });

    expect(callsHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ callerId: 'user-a', calleeId: 'user-b', kind: 'VIDEO', status: 'MISSED' }),
    );
  });

  it('call-user → accept-call → end-call пишет COMPLETED (звонок был принят)', async () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    await gateway.onCallUser(a, { to: 'user-b', callId: 'call-history-3', kind: 'audio' });
    await gateway.onAcceptCall(b, { to: 'user-a', callId: 'call-history-3' });
    await gateway.onEndCall(b, { to: 'user-a', callId: 'call-history-3' });

    expect(callsHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ callerId: 'user-a', calleeId: 'user-b', kind: 'AUDIO', status: 'COMPLETED' }),
    );
  });

  it('call-user → reject-call пишет REJECTED', async () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    await gateway.onCallUser(a, { to: 'user-b', callId: 'call-history-4', kind: 'audio' });
    await gateway.onRejectCall(b, { to: 'user-a', callId: 'call-history-4' });

    expect(callsHistory.record).toHaveBeenCalledWith(
      expect.objectContaining({ callerId: 'user-a', calleeId: 'user-b', kind: 'AUDIO', status: 'REJECTED' }),
    );
  });

  it('end-call без предшествующего call-user не пишет историю (нет активного звонка)', async () => {
    const a = connectUser('user-a');
    callsHistory.record.mockClear();

    await gateway.onEndCall(a, { to: 'user-b', callId: 'unknown-call' });

    expect(callsHistory.record).not.toHaveBeenCalled();
  });

  describe('multi-instance relay (Valkey presence.enabled = true)', () => {
    beforeEach(() => {
      presence.enabled = true;
    });

    it('call-user доставляется через relay, если получателя нет локально, но он online в другом инстансе', async () => {
      const a = connectUser('user-a');
      presence.isOnlineAnywhere.mockResolvedValue(true);

      const delivered = await (gateway as any).relay('user-remote', 'incoming-call', {
        from: 'user-a',
        callId: 'call-remote-1',
        kind: 'audio',
      });

      expect(delivered).toBe(true);
      expect(presence.publishRelay).toHaveBeenCalledWith({
        targetUserId: 'user-remote',
        event: 'incoming-call',
        data: { from: 'user-a', callId: 'call-remote-1', kind: 'audio' },
      });
      expect(a.send).not.toHaveBeenCalled();
    });

    it('call-user отвечает call-failed, если получателя нет ни локально, ни в presence-наборе', async () => {
      const a = connectUser('user-a');
      presence.isOnlineAnywhere.mockResolvedValue(false);

      await gateway.onCallUser(a, { to: 'user-nowhere', callId: 'call-remote-2', kind: 'audio' });

      expect(presence.publishRelay).not.toHaveBeenCalled();
      expect(a.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'call-failed', data: { callId: 'call-remote-2', reason: 'user-offline' } }),
      );
    });

    it('входящее relay-сообщение от другого инстанса доставляется локальному сокету, если получатель здесь', () => {
      const b = connectUser('user-b');
      // onModuleInit регистрирует обработчик — в реальном приложении Nest
      // вызывает его сам при старте, в юнит-тесте — вызываем явно.
      gateway.onModuleInit();
      const handler = presence.setOnRelayMessage.mock.calls[0][0];

      handler({ targetUserId: 'user-b', event: 'incoming-call', data: { from: 'user-a', callId: 'call-x', kind: 'audio' } });

      expect(b.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'incoming-call', data: { from: 'user-a', callId: 'call-x', kind: 'audio' } }),
      );
    });
  });

  describe('групповые звонки (join-call-room/leave-call-room)', () => {
    it('первый участник комнаты получает room-peers с пустым списком', async () => {
      const a = connectUser('user-a');

      await gateway.onJoinCallRoom(a, { callRoomId: 'room-1', kind: 'video' });

      expect(a.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'room-peers', data: { callRoomId: 'room-1', peers: [] } }),
      );
    });

    it('второй участник получает room-peers со списком уже присутствующих, первый — peer-joined', async () => {
      const a = connectUser('user-a');
      const b = connectUser('user-b');

      await gateway.onJoinCallRoom(a, { callRoomId: 'room-1', kind: 'video' });
      await gateway.onJoinCallRoom(b, { callRoomId: 'room-1', kind: 'video' });

      expect(b.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'room-peers', data: { callRoomId: 'room-1', peers: ['user-a'] } }),
      );
      expect(a.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'peer-joined', data: { callRoomId: 'room-1', peerId: 'user-b', kind: 'video' } }),
      );
    });

    it('пятый участник получает call-room-full и не добавляется в комнату', async () => {
      const sockets = ['user-a', 'user-b', 'user-c', 'user-d'].map((id) => connectUser(id));
      for (let i = 0; i < sockets.length; i++) {
        await gateway.onJoinCallRoom(sockets[i], { callRoomId: 'room-full', kind: 'audio' });
      }
      const fifth = connectUser('user-e');

      await gateway.onJoinCallRoom(fifth, { callRoomId: 'room-full', kind: 'audio' });

      expect(fifth.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'call-room-full', data: { callRoomId: 'room-full' } }),
      );
    });

    it('leave-call-room уведомляет оставшихся участников peer-left', async () => {
      const a = connectUser('user-a');
      const b = connectUser('user-b');
      await gateway.onJoinCallRoom(a, { callRoomId: 'room-2', kind: 'audio' });
      await gateway.onJoinCallRoom(b, { callRoomId: 'room-2', kind: 'audio' });

      await gateway.onLeaveCallRoom(b, { callRoomId: 'room-2' });

      expect(a.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'peer-left', data: { callRoomId: 'room-2', peerId: 'user-b' } }),
      );
    });

    it('disconnect автоматически убирает пользователя из его комнат с уведомлением', async () => {
      const a = connectUser('user-a');
      const b = connectUser('user-b');
      await gateway.onJoinCallRoom(a, { callRoomId: 'room-3', kind: 'audio' });
      await gateway.onJoinCallRoom(b, { callRoomId: 'room-3', kind: 'audio' });

      gateway.handleDisconnect(b);
      await Promise.resolve(); // дать событийному циклу дойти до async leaveCallRoom

      expect(a.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'peer-left', data: { callRoomId: 'room-3', peerId: 'user-b' } }),
      );
    });

    it('offer/answer/ice-candidate переиспользуются для mesh-пар с callRoomId вместо callId', async () => {
      const a = connectUser('user-a');
      const b = connectUser('user-b');

      await gateway.onOffer(a, { to: 'user-b', callId: 'room-mesh', sdp: { type: 'offer', sdp: 'x' } });

      expect(b.send).toHaveBeenCalledWith(
        JSON.stringify({ event: 'offer', data: { from: 'user-a', callId: 'room-mesh', sdp: { type: 'offer', sdp: 'x' } } }),
      );
    });
  });
});
