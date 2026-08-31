import { Module } from '@nestjs/common';
import { PublicRunsController, RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { TestsModule } from '../tests/tests.module';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [TestsModule, StudentsModule],
  controllers: [RunsController, PublicRunsController],
  providers: [RunsService],
  exports: [RunsService],
})
export class RunsModule {}
