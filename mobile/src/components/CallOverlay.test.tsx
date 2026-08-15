import { render, screen } from '@testing-library/react-native';
import { CallOverlay } from './CallOverlay';
import { useCalls } from '../calls/calls-context';

// react-native-webrtc — нативный модуль, недоступен в jest-окружении;
// подменяем минимальной заглушкой только для рендера сетки плиток.
jest.mock('react-native-webrtc', () => ({
  RTCView: 'RTCView',
  MediaStream: class {},
}));

jest.mock('../calls/calls-context', () => ({
  useCalls: jest.fn(),
}));

const mockUseCalls = useCalls as jest.Mock;

describe('CallOverlay — групповой звонок (блок I)', () => {
  it('рендерит по плитке на себя и каждого участника комнаты', () => {
    mockUseCalls.mockReturnValue({
      status: 'connected',
      group: {
        callRoomId: 'room1',
        kind: 'audio',
        localStream: null,
        muted: false,
        peers: [
          { userId: 'user-b', stream: null },
          { userId: 'user-c', stream: null },
        ],
      },
      groupError: null,
      leaveCallRoom: jest.fn(),
      toggleGroupMute: jest.fn(),
      resolvePeerName: jest.fn().mockResolvedValue('Участник клуба'),
    });

    render(<CallOverlay />);

    expect(screen.getByText(/Групповой аудиозвонок · 3\/4/)).toBeTruthy();
  });

  it('в режиме idle без группового звонка ничего не рендерит', () => {
    mockUseCalls.mockReturnValue({
      status: 'idle',
      error: null,
      group: null,
      groupError: null,
    });

    const { toJSON } = render(<CallOverlay />);
    expect(toJSON()).toBeNull();
  });
});
