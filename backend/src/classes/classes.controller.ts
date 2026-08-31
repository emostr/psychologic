import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccountRole } from '@prisma/client';
import { ClassesService } from './classes.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateClassDto, TransferClassDto, UpdateClassDto } from './dto/classes.dto';

@Controller('classes')
@Roles(AccountRole.PSYCHOLOGIST)
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}

  @Get()
  list(@Query('archived') archived?: string) {
    return this.classes.list(archived === 'true');
  }

  @Post()
  create(@Body() dto: CreateClassDto) {
    return this.classes.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClassDto) {
    return this.classes.update(id, dto);
  }

  @Post(':id/transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferClassDto) {
    return this.classes.transfer(id, dto.number, dto.letter);
  }

  @Post('promote-year')
  promoteYear() {
    return this.classes.promoteYear();
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.classes.archive(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.classes.restore(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.classes.remove(id);
  }
}
