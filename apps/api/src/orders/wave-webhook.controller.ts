import {
  Controller,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator.js';
import { WaveService } from './wave.service.js';

/**
 * Optional Wave webhook of a shop (ADR-065): the address the shop registers
 * in its Wave portal, with the secret Wave shows it once.
 */
@Public()
@Controller('public/wave/webhooks')
export class WaveWebhookController {
  constructor(private readonly wave: WaveService) {}

  @Post(':organizationId')
  @HttpCode(200)
  async receive(
    @Param('organizationId') organizationId: string,
    @Headers('wave-signature') signature: string | undefined,
    @Headers('authorization') authorization: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    // The signature is checked on the bytes received, never re-serialized.
    const raw = request.rawBody?.toString('utf8') ?? '';
    await this.wave.webhook(organizationId, { signature, authorization }, raw);
    return { received: true };
  }
}
