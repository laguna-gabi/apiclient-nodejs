import { Controller, Get, Post } from '@nestjs/common';
import { MemberService } from './member.service';
import { Member } from './member.schema';

@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  async create() {
    await this.memberService.create();
  }

  @Get()
  async findAll(): Promise<Member[]> {
    return this.memberService.findAll();
  }
}
