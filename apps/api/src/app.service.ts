import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      service: 'dental-api',
      status: 'ok',
    };
  }
}
