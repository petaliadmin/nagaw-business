import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  addTaskNoteSchema,
  changeTaskStatusSchema,
  createTaskSchema,
  updateTaskSchema,
  type AddTaskNoteInput,
  type ChangeTaskStatusInput,
  type CreateTaskInput,
  type TaskDto,
  type TaskHistoryEntryDto,
  type TaskNoteDto,
  type TaskSummaryDto,
  type UpdateTaskInput,
} from '@nagaw/shared';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { TasksService } from './tasks.service.js';

/**
 * Manual task tracking (ADR-017). Route permissions are the floor; the
 * service also checks who may launch a task or move it forward.
 */
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @RequirePermission('tasks.read')
  list(
    @CurrentTenant() tenant: TenantContext,
    @Query('assigneeUserId') assigneeUserId?: string,
    @Query('responsibilityId') responsibilityId?: string,
    @Query('status') status?: string,
  ): Promise<TaskDto[]> {
    return this.tasks.list(tenant.organizationId, {
      assigneeUserId,
      responsibilityId,
      status,
    });
  }

  @Get('summary')
  @RequirePermission('tasks.read')
  summary(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
  ): Promise<TaskSummaryDto> {
    return this.tasks.summary(tenant.organizationId, user.userId);
  }

  @Post()
  @RequirePermission('tasks.work')
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createTaskSchema)) body: CreateTaskInput,
    @RequestId() requestId: string | null,
  ): Promise<TaskDto> {
    return this.tasks.create(tenant, user, body, requestId);
  }

  @Get(':id')
  @RequirePermission('tasks.read')
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<TaskDto> {
    return this.tasks.get(tenant.organizationId, id);
  }

  /** Replaces the editable fields; the status has its own endpoint. */
  @Put(':id')
  @RequirePermission('tasks.manage')
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) body: UpdateTaskInput,
    @RequestId() requestId: string | null,
  ): Promise<TaskDto> {
    return this.tasks.update(tenant, user, id, body, requestId);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('tasks.work')
  changeStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeTaskStatusSchema))
    body: ChangeTaskStatusInput,
    @RequestId() requestId: string | null,
  ): Promise<TaskDto> {
    return this.tasks.changeStatus(tenant, user, id, body, requestId);
  }

  @Get(':id/notes')
  @RequirePermission('tasks.read')
  notes(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<TaskNoteDto[]> {
    return this.tasks.notes(tenant.organizationId, id);
  }

  @Post(':id/notes')
  @RequirePermission('tasks.work')
  addNote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addTaskNoteSchema)) body: AddTaskNoteInput,
    @RequestId() requestId: string | null,
  ): Promise<TaskNoteDto> {
    return this.tasks.addNote(tenant, user, id, body.body, requestId);
  }

  @Get(':id/history')
  @RequirePermission('tasks.read')
  history(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<TaskHistoryEntryDto[]> {
    return this.tasks.history(tenant.organizationId, id);
  }
}
