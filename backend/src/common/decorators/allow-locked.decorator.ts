import { SetMetadata } from '@nestjs/common';

export const ALLOW_LOCKED_KEY = 'allowLocked';

/**
 * Маршрут работает и при заблокированной ПИНом сессии: сам ввод ПИНа,
 * чтение профиля и выход.
 */
export const AllowLocked = () => SetMetadata(ALLOW_LOCKED_KEY, true);
