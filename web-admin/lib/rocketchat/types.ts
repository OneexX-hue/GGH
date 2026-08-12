export interface RocketChatSession {
  baseUrl: string;
  wsUrl: string;
  rocketChatUserId: string;
  authToken: string;
}

export type RoomType = 'd' | 'p' | 'c';

export interface RCSubscription {
  _id: string;
  rid: string;
  t: RoomType;
  name?: string;
  fname?: string;
  unread: number;
  alert: boolean;
  f?: boolean;
  lastMessage?: { msg?: string };
  _updatedAt: string;
}

export interface RCMessageUser {
  _id: string;
  username: string;
  name?: string;
}

export interface RCMessage {
  _id: string;
  rid: string;
  msg: string;
  ts: string;
  u: RCMessageUser;
  _updatedAt?: string;
}

export interface RCRoom {
  _id: string;
  t: RoomType;
  name?: string;
}
