import { timingSafeEqual } from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  publicOrderSchema,
  type PublicOrderInput,
  type PublicOrderResultDto,
  type PublicStorefrontDto,
  type PublicTrackingDto,
} from '@nagaw/shared';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ENV, type Env } from '../config/env.js';
import { StorefrontService } from './storefront.service.js';

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Ma vitrine, public part (ADR-075): no session, no organization header.
 * The shop is found from the address only, and only what a customer may
 * see leaves.
 */
@Public()
@Controller('public/storefronts')
export class StorefrontPublicController {
  constructor(
    private readonly storefront: StorefrontService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * The visitor's address, for the limits. The web app relays it, behind
   * the shared secret; anyone else is counted at their own address.
   */
  private visitorAddress(request: Request): string {
    const secret = this.env.STOREFRONT_RELAY_SECRET;
    const relay = request.headers['x-storefront-relay'];
    const visitor = request.headers['x-storefront-visitor'];
    if (
      secret &&
      typeof relay === 'string' &&
      sameSecret(relay, secret) &&
      typeof visitor === 'string' &&
      visitor.length > 0 &&
      visitor.length <= 64
    )
      return visitor;
    // Vercel writes this header itself (the visitor's address first),
    // whatever the visitor sent; without a proxy, the socket's address.
    const forwarded = request.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(',')[0]
      ?.trim();
    return first || request.ip || 'unknown';
  }

  @Get(':slug')
  storefrontOf(@Param('slug') slug: string): Promise<PublicStorefrontDto> {
    return this.storefront.storefront(slug);
  }

  @Get(':slug/logo')
  async logo(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const logo = await this.storefront.logo(slug);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', `"${logo.sha256}"`);
    return new StreamableFile(logo.data, { type: logo.contentType });
  }

  @Get(':slug/articles/:handle/photo')
  async photo(
    @Param('slug') slug: string,
    @Param('handle') handle: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const photo = await this.storefront.photo(slug, handle);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('ETag', `"${photo.sha256}"`);
    return new StreamableFile(photo.data, { type: photo.contentType });
  }

  @Post(':slug/visits')
  @HttpCode(HttpStatus.NO_CONTENT)
  async visit(@Param('slug') slug: string): Promise<void> {
    await this.storefront.visit(slug);
  }

  @Post(':slug/orders')
  async order(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(publicOrderSchema)) body: PublicOrderInput,
    @Req() request: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicOrderResultDto> {
    const { result, replayed } = await this.storefront.placeOrder(
      slug,
      body,
      this.visitorAddress(request),
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Get(':slug/tracking/:token')
  tracking(
    @Param('slug') slug: string,
    @Param('token') token: string,
  ): Promise<PublicTrackingDto> {
    return this.storefront.tracking(slug, token);
  }
}
