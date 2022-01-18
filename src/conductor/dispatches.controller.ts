import { Controller, Get, Param, Query } from '@nestjs/common';
import { Dispatch, DispatchDto, DispatchStatus, DispatchesService } from '.';
import { ApiQuery } from '@nestjs/swagger';
import { ParseDispatchProjectionArray } from '.';

@Controller('dispatches')
export class DispatchesController {
  constructor(private dispatchesService: DispatchesService) {}

  //-----------------------------------------------------------------------------------------------
  //---------------------------------  Open API Documentation -------------------------------------
  //-----------------------------------------------------------------------------------------------
  @ApiQuery({
    name: 'status',
    type: String,
    description:
      'Dispatch status. default value is `done`' +
      `\n\n\tOptions: [${Object.values(DispatchStatus)}]`,
    required: false,
  })
  @ApiQuery({
    name: 'projection',
    type: String,
    description:
      'Comma separated list of projected fields. default value is `undefined` (all fields)' +
      `\n\n\tOptions: [${Object.keys(DispatchDto.paths)}]`,
    required: false,
  })
  //-----------------------------------------------------------------------------------------------
  @Get(':senderClientId')
  async getBySenderClientId(
    @Param('senderClientId') senderClientId: string,
    @Query('status') status: DispatchStatus = DispatchStatus.done,
    @Query('projection', new ParseDispatchProjectionArray())
    projection?: string[],
  ): Promise<Dispatch[] | null> {
    return await this.dispatchesService.find({ senderClientId, status }, projection);
  }
}
