import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagService {
  isControlGroup(): boolean {
    // returns true 50% of times
    return Math.random() >= 0.5;
  }
}
