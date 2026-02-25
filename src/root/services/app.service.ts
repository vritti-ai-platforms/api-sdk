import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // Returns the API welcome message
  getHello(): string {
    return `Hello World!`;
  }
}
