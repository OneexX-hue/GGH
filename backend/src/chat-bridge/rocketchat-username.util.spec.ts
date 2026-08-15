import { rocketChatUsernameFor, userIdPrefixFromRcUsername } from './rocketchat-username.util';

describe('rocketchat-username.util', () => {
  it('rocketChatUsernameFor детерминированно строит username из первых 8 символов userId', () => {
    expect(rocketChatUsernameFor('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('carclub_a1b2c3d4');
  });

  it('userIdPrefixFromRcUsername обращает rocketChatUsernameFor', () => {
    const userId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const username = rocketChatUsernameFor(userId);
    expect(userIdPrefixFromRcUsername(username)).toBe('a1b2c3d4');
  });

  it('userIdPrefixFromRcUsername возвращает null для чужого формата username', () => {
    expect(userIdPrefixFromRcUsername('alexey')).toBeNull();
    expect(userIdPrefixFromRcUsername('carclub_short')).toBe(null);
  });
});
