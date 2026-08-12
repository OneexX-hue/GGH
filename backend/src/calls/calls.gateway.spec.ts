import { CallsGateway } from './calls.gateway';

function fakeSocket() {
  return { send: jest.fn(), close: jest.fn() } as any;
}

describe('CallsGateway', () => {
  let jwt: any;
  let config: any;
  let gateway: CallsGateway;

  beforeEach(() => {
    jwt = { verify: jest.fn() };
    config = { get: jest.fn().mockReturnValue('test-secret') };
    gateway = new CallsGateway(jwt, config);
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

  it('call-user пересылает incoming-call онлайн-получателю', () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    gateway.onCallUser(a, { to: 'user-b', callId: 'call-1', kind: 'video' });

    expect(b.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'incoming-call', data: { from: 'user-a', callId: 'call-1', kind: 'video' } }),
    );
    expect(a.send).not.toHaveBeenCalled();
  });

  it('call-user отвечает call-failed, если получатель не в сети', () => {
    const a = connectUser('user-a');

    gateway.onCallUser(a, { to: 'user-offline', callId: 'call-2', kind: 'audio' });

    expect(a.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'call-failed', data: { callId: 'call-2', reason: 'user-offline' } }),
    );
  });

  it('offer/answer/ice-candidate релеятся с полем from от сервера, не от клиента', () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    gateway.onOffer(a, { to: 'user-b', callId: 'call-1', sdp: { type: 'offer', sdp: 'x' } });
    expect(b.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'offer', data: { from: 'user-a', callId: 'call-1', sdp: { type: 'offer', sdp: 'x' } } }),
    );

    gateway.onAnswer(b, { to: 'user-a', callId: 'call-1', sdp: { type: 'answer', sdp: 'y' } });
    expect(a.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'answer', data: { from: 'user-b', callId: 'call-1', sdp: { type: 'answer', sdp: 'y' } } }),
    );

    gateway.onIceCandidate(a, { to: 'user-b', callId: 'call-1', candidate: { c: 1 } });
    expect(b.send).toHaveBeenLastCalledWith(
      JSON.stringify({ event: 'ice-candidate', data: { from: 'user-a', callId: 'call-1', candidate: { c: 1 } } }),
    );
  });

  it('после disconnect пользователь больше не получает сигналы (удалён из presence)', () => {
    const a = connectUser('user-a');
    const b = connectUser('user-b');

    gateway.handleDisconnect(b);
    gateway.onCallUser(a, { to: 'user-b', callId: 'call-3', kind: 'audio' });

    expect(b.send).not.toHaveBeenCalled();
    expect(a.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'call-failed', data: { callId: 'call-3', reason: 'user-offline' } }),
    );
  });

  it('disconnect не удаляет более нового сокета того же пользователя (переподключение)', () => {
    const first = connectUser('user-a');
    const second = connectUser('user-a'); // тот же userId переподключился новым сокетом

    gateway.handleDisconnect(first); // старый сокет отключился уже после переподключения

    const other = connectUser('user-b');
    gateway.onCallUser(other, { to: 'user-a', callId: 'call-4', kind: 'audio' });

    expect(second.send).toHaveBeenCalledWith(
      JSON.stringify({ event: 'incoming-call', data: { from: 'user-b', callId: 'call-4', kind: 'audio' } }),
    );
  });
});
