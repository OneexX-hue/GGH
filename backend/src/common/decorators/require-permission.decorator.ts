import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (permissionKey: string) => SetMetadata(PERMISSION_KEY, permissionKey);
