import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 423 Locked — сессия жива, но психолог давно не подтверждал присутствие.
 * Фронтенд по этому коду показывает оверлей ввода ПИН-кода, не разлогинивая.
 */
export class SessionLockedException extends HttpException {
  constructor() {
    super({ statusCode: HttpStatus.LOCKED, error: 'SESSION_LOCKED', message: 'Введите ПИН-код' }, HttpStatus.LOCKED);
  }
}
