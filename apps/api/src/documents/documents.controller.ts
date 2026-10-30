import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Put,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  cancelInvoiceSchema,
  changeQuoteStatusSchema,
  createInvoiceSchema,
  createQuoteSchema,
  fromSaleSchema,
  fromSourceSchema,
  invoicePaymentSchema,
  pageQuerySchema,
  updateInvoiceSchema,
  updateQuoteSchema,
  type CancelInvoiceInput,
  type CreateInvoiceInput,
  type CreateQuoteInput,
  type DocumentListItemDto,
  type DocumentStatsDto,
  type PageQuery,
  type FromSaleInput,
  type InvoiceDto,
  type InvoicePaymentInput,
  type QuoteDto,
  type ShopIdentityDto,
  type UpdateInvoiceInput,
  type UpdateQuoteInput,
} from '@nagaw/shared';
import type { Response } from 'express';
import type { z } from 'zod';
import type { AuthContext, TenantContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DatabaseService } from '../database/database.service.js';
import {
  CurrentTenant,
  CurrentUser,
  RequestId,
} from '../tenancy/current.decorator.js';
import { RequirePermission } from '../tenancy/require-permission.decorator.js';
import { DocumentsService } from './documents.service.js';
import { renderDocumentPdf } from './pdf.js';

function pdfFile(
  res: Response,
  data: Uint8Array,
  name: string,
): StreamableFile {
  res.setHeader('Cache-Control', 'private, no-store');
  return new StreamableFile(Buffer.from(data), {
    type: 'application/pdf',
    disposition: `inline; filename="${name}.pdf"`,
  });
}

/**
 * Quotes, invoices and credit notes (ADR-026). A replayed creation (same
 * clientOperationId) answers 200 with the original document instead of 201.
 */
@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly database: DatabaseService,
  ) {}

  @Get('documents/shop')
  @RequirePermission('documents.read')
  async shop(@CurrentTenant() tenant: TenantContext): Promise<ShopIdentityDto> {
    return this.documents.identity(
      await this.documents.shop(this.database.db, tenant.organizationId),
    );
  }

  /** The shop's totals: never for sellers (ADR-036). */
  @Get('documents/stats')
  @RequirePermission('stats.read')
  stats(@CurrentTenant() tenant: TenantContext): Promise<DocumentStatsDto> {
    return this.documents.stats(tenant.organizationId);
  }

  // Quotes -------------------------------------------------------------------

  @Get('quotes')
  @RequirePermission('documents.read')
  listQuotes(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(pageQuerySchema)) page: PageQuery,
  ): Promise<DocumentListItemDto[]> {
    return this.documents.listQuotes(tenant.organizationId, page);
  }

  @Post('quotes')
  @RequirePermission('quotes.manage')
  async createQuote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createQuoteSchema)) body: CreateQuoteInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<QuoteDto> {
    const { quote, replayed } = await this.documents.createQuote(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return quote;
  }

  @Get('quotes/:id')
  @RequirePermission('documents.read')
  getQuote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuoteDto> {
    return this.documents.getQuote(this.database.db, tenant.organizationId, id);
  }

  @Put('quotes/:id')
  @RequirePermission('quotes.manage')
  updateQuote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateQuoteSchema)) body: UpdateQuoteInput,
    @RequestId() requestId: string | null,
  ): Promise<QuoteDto> {
    return this.documents.updateQuote(tenant, user, id, body, requestId);
  }

  @Post('quotes/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('quotes.manage')
  changeQuoteStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeQuoteStatusSchema))
    body: z.infer<typeof changeQuoteStatusSchema>,
    @RequestId() requestId: string | null,
  ): Promise<QuoteDto> {
    return this.documents.changeQuoteStatus(
      tenant,
      user,
      id,
      body.status,
      requestId,
    );
  }

  @Post('quotes/:id/invoice')
  @RequirePermission('documents.manage')
  async invoiceFromQuote(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(fromSourceSchema))
    body: z.infer<typeof fromSourceSchema>,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvoiceDto> {
    const { invoice, replayed } = await this.documents.invoiceFromQuote(
      tenant,
      user,
      id,
      body.clientOperationId,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return invoice;
  }

  @Get('quotes/:id/pdf')
  @RequirePermission('documents.read')
  async quotePdf(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const db = this.database.db;
    const [quote, shop, logo] = await Promise.all([
      this.documents.getQuote(db, tenant.organizationId, id),
      this.documents.shop(db, tenant.organizationId),
      this.documents.logo(tenant.organizationId),
    ]);
    const data = await renderDocumentPdf(
      this.documents.identity(shop),
      shop.default_currency,
      {
        kind: 'quote',
        quote,
      },
      logo,
    );
    return pdfFile(res, data, quote.number);
  }

  // Invoices -----------------------------------------------------------------

  @Get('invoices')
  @RequirePermission('documents.read')
  listInvoices(
    @CurrentTenant() tenant: TenantContext,
    @Query(new ZodValidationPipe(pageQuerySchema)) page: PageQuery,
  ): Promise<DocumentListItemDto[]> {
    return this.documents.listInvoices(tenant.organizationId, page);
  }

  @Post('invoices')
  @RequirePermission('documents.manage')
  async createInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvoiceDto> {
    const { invoice, replayed } = await this.documents.createInvoice(
      tenant,
      user,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return invoice;
  }

  @Post('invoices/from-sale/:saleId')
  @RequirePermission('documents.manage')
  async invoiceFromSale(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('saleId') saleId: string,
    @Body(new ZodValidationPipe(fromSaleSchema)) body: FromSaleInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvoiceDto> {
    const { invoice, replayed } = await this.documents.invoiceFromSale(
      tenant,
      user,
      saleId,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return invoice;
  }

  @Get('invoices/:id')
  @RequirePermission('documents.read')
  getInvoice(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<InvoiceDto> {
    return this.documents.getInvoice(
      this.database.db,
      tenant.organizationId,
      id,
    );
  }

  @Put('invoices/:id')
  @RequirePermission('documents.manage')
  updateInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
    @RequestId() requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.documents.updateInvoice(tenant, user, id, body, requestId);
  }

  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('documents.manage')
  issueInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @RequestId() requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.documents.issueInvoice(tenant, user, id, requestId);
  }

  @Post('invoices/:id/payments')
  @RequirePermission('documents.manage')
  async addPayment(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(invoicePaymentSchema))
    body: InvoicePaymentInput,
    @RequestId() requestId: string | null,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvoiceDto> {
    const { invoice, replayed } = await this.documents.addPayment(
      tenant,
      user,
      id,
      body,
      requestId,
    );
    res.status(replayed ? HttpStatus.OK : HttpStatus.CREATED);
    return invoice;
  }

  @Post('invoices/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('documents.manage')
  cancelInvoice(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: AuthContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelInvoiceSchema)) body: CancelInvoiceInput,
    @RequestId() requestId: string | null,
  ): Promise<InvoiceDto> {
    return this.documents.cancelInvoice(tenant, user, id, body, requestId);
  }

  @Get('invoices/:id/pdf')
  @RequirePermission('documents.read')
  async invoicePdf(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const db = this.database.db;
    const [invoice, shop, logo, marks] = await Promise.all([
      this.documents.getInvoice(db, tenant.organizationId, id),
      this.documents.shop(db, tenant.organizationId),
      this.documents.logo(tenant.organizationId),
      this.documents.marks(tenant.organizationId),
    ]);
    const data = await renderDocumentPdf(
      this.documents.identity(shop),
      shop.default_currency,
      {
        kind: 'invoice',
        invoice,
      },
      logo,
      marks,
    );
    return pdfFile(res, data, invoice.number ?? 'facture-brouillon');
  }
}
