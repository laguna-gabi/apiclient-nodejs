import { Controller } from '@nestjs/common';
import { TriggersService } from '.';

@Controller('triggers')
export class TriggersController {
  constructor(private readonly triggersService: TriggersService) {}
}
