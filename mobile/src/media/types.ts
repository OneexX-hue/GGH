export type MediaKind = 'PHOTO' | 'VIDEO';

export interface UploadMediaResult {
  mediaId: string;
  kind: MediaKind;
}

export interface MediaAccessTokenResult {
  token: string;
  expiresAt: string;
  viewerDisplayName: string;
}
