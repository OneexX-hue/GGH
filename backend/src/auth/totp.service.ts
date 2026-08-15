import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';

// TOTP-каркас для 2FA, обязательной для админ-ролей (ТЗ гл. 3.1, 4).
@Injectable()
export class TotpService {
  generateSecret(): string {
    return authenticator.generateSecret();
  }

  keyUri(accountName: string, secret: string): string {
    return authenticator.keyuri(accountName, 'CarClub', secret);
  }

  verify(token: string, secret: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }
}
