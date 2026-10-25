import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  answerFeedbackSchema,
  createFeedbackSchema,
  type AdminFeedbackDto,
  type AnswerFeedbackInput,
  type CreateFeedbackInput,
  type FeedbackDto,
} from '@nagaw/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { PlatformAdminGuard } from '../admin/platform-admin.guard.js';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { FeedbackService } from './feedback.service.js';

const statusQuerySchema = z
  .object({ status: z.enum(['new', 'read', 'done']).optional() })
  .strict();

/** A person of a shop writes to the platform (ADR-032). */
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  @RequirePermission('feedback.send')
  mine(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
  ): Promise<FeedbackDto[]> {
    return this.feedback.mine(tenant, user);
  }

  @Post()
  @RequirePermission('feedback.send')
  async send(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createFeedbackSchema))
    body: CreateFeedbackInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<FeedbackDto> {
    const { feedback, replayed } = await this.feedback.send(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return feedback;
  }
}

/** The platform reads and answers every shop's messages. */
@Controller('admin/feedback')
@UseGuards(PlatformAdminGuard)
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  all(
    @Query(new ZodValidationPipe(statusQuerySchema))
    query: z.infer<typeof statusQuerySchema>,
  ): Promise<AdminFeedbackDto[]> {
    return this.feedback.all(query.status);
  }

  @Post(':id')
  @HttpCode(HttpStatus.OK)
  answer(
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(answerFeedbackSchema))
    body: AnswerFeedbackInput,
    @RequestId() requestId: string | null,
  ): Promise<AdminFeedbackDto> {
    return this.feedback.answer(user, id, body, requestId);
  }
}
