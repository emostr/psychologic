import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AccountRole, StudentOrigin } from '@prisma/client';
import { StudentsService } from './students.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAccount } from '../common/decorators/current-account.decorator';
import { RequestAccount } from '../common/types';
import {
  CreateStudentDto,
  MergeStudentsDto,
  NoteDto,
  SetOriginDto,
  StudentQueryDto,
  TagDto,
  TransferStudentDto,
  UpdateStudentDto,
} from './dto/students.dto';

@Controller('students')
@Roles(AccountRole.PSYCHOLOGIST)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Query() query: StudentQueryDto) {
    return this.students.list(query);
  }

  @Post()
  create(@Body() dto: CreateStudentDto) {
    return this.students.create(dto);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.students.detail(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(id, dto);
  }

  @Post(':id/transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferStudentDto) {
    return this.students.transfer(id, dto.classId);
  }

  @Post(':id/origin')
  setOrigin(@Param('id') id: string, @Body() dto: SetOriginDto) {
    return this.students.setOrigin(id, dto.origin as StudentOrigin);
  }

  @Post(':id/merge')
  merge(@Param('id') id: string, @Body() dto: MergeStudentsDto) {
    return this.students.merge(id, dto.sourceId);
  }

  @Post(':id/dismiss-duplicate')
  dismissDuplicate(@Param('id') id: string) {
    return this.students.dismissDuplicate(id);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.students.archive(id);
  }

  @Post(':id/restore')
  restore(@Param('id') id: string) {
    return this.students.restore(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.students.remove(id);
  }

  @Post(':id/notes')
  addNote(@Param('id') id: string, @CurrentAccount() account: RequestAccount, @Body() dto: NoteDto) {
    return this.students.addNote(id, account.id, dto);
  }

  @Patch('notes/:noteId')
  updateNote(@Param('noteId') noteId: string, @Body() dto: NoteDto) {
    return this.students.updateNote(noteId, dto);
  }

  @Delete('notes/:noteId')
  removeNote(@Param('noteId') noteId: string) {
    return this.students.removeNote(noteId);
  }

  @Post(':id/tags')
  addTag(@Param('id') id: string, @CurrentAccount() account: RequestAccount, @Body() dto: TagDto) {
    return this.students.addTag(id, account.id, dto);
  }

  @Delete('tags/:tagId')
  removeTag(@Param('tagId') tagId: string) {
    return this.students.removeTag(tagId);
  }
}
