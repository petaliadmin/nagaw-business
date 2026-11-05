import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  publicOrderSchema,
  type PublicCatalogDto,
  type PublicOrderInput,
  type PublicOrderReceiptDto,
} from '@nagaw/shared';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { ProductsService } from '../catalog/products.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { OrdersService } from './orders.service.js';

/**
 * The public page of a shop (ADR-063): no session. Only what a customer may
 * see leaves here; a shop that is not published answers as if it did not
 * exist.
 */
@Public()
@Controller('public/shops/:slug')
export class PublicCatalogController {
  constructor(
    private readonly orders: OrdersService,
    private readonly organizations: OrganizationsService,
    private readonly products: ProductsService,
  ) {}

  @Get()
  catalog(@Param('slug') slug: string): Promise<PublicCatalogDto> {
    return this.orders.catalog(slug);
  }

  @Get('logo')
  async logo(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const logo = await this.organizations.logo(
      await this.orders.openShopId(slug),
    );
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(logo.data, { type: logo.contentType });
  }

  @Get('products/:id/photo')
  async photo(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const shopId = await this.orders.openShopId(slug);
    await this.orders.assertOnline(shopId, id);
    const photo = await this.products.photo(shopId, id);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return new StreamableFile(photo.data, { type: photo.contentType });
  }

  @Post('orders')
  place(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(publicOrderSchema)) body: PublicOrderInput,
  ): Promise<PublicOrderReceiptDto> {
    return this.orders.place(slug, body);
  }
}
