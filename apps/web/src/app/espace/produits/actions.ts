'use server';

import {
  createCategorySchema,
  createProductSchema,
  createProductUnitSchema,
  createUnitTemplateSchema,
  createStockMovementSchema,
  createSupplierSchema,
  createTaxRateSchema,
  PRODUCT_PHOTO_MAX_BYTES,
  PRODUCT_PHOTO_TYPES,
  updateCategorySchema,
  updateProductSchema,
  updateProductUnitSchema,
  updateSupplierSchema,
  updateTaxRateSchema,
  type CategoryDto,
  type ProductDto,
  type RecordedStockMovementDto,
  type SupplierDto,
  type TaxRateDto,
  type UnitTemplateDto,
} from '@nagaw/shared';
import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { apiErrorState } from '@/lib/api/form-error';
import { apiAsUser } from '@/lib/api/server';
import { parseValues, type FormState } from '@/lib/auth/schemas';
import {
  optionalAmountField,
  optionalIdField,
  optionalQuantityField,
  productValues,
  quantityField,
} from '@/lib/catalog/form';
import { formatQuantity } from '@/lib/catalog/labels';
import { requireReadyWorkspace } from '@/lib/workspace/load';

/**
 * The shop of the page that sent the form must still be the active one:
 * otherwise amounts would be read in the wrong currency. The API checks
 * membership on every call regardless.
 */
type Shop =
  | { ok: false; error: FormState }
  | { ok: true; token: string; organizationId: string; currency: string };

async function shopOf(formData: FormData): Promise<Shop> {
  const workspace = await requireReadyWorkspace();
  if (!workspace) redirect('/espace');
  const formShop = formData.get('organizationId')?.toString();
  if (formShop !== workspace.organization.id) {
    return {
      ok: false,
      error: {
        status: 'error',
        message:
          'La boutique active a changé dans un autre onglet. Rechargez la page.',
      },
    };
  }
  return {
    ok: true,
    token: workspace.accessToken,
    organizationId: workspace.organization.id,
    currency: workspace.organization.defaultCurrency,
  };
}

const text = (formData: FormData, name: string) =>
  formData.get(name)?.toString() ?? '';

/** Photo chosen in the form, already resized on the device. */
function photoOf(formData: FormData): File | null | 'invalid' {
  const file = formData.get('photo');
  if (!(file instanceof File) || file.size === 0) return null;
  if (
    file.size > PRODUCT_PHOTO_MAX_BYTES ||
    !(PRODUCT_PHOTO_TYPES as readonly string[]).includes(file.type)
  )
    return 'invalid';
  return file;
}

async function uploadPhoto(
  token: string,
  organizationId: string,
  productId: string,
  photo: File,
): Promise<boolean> {
  const result = await apiAsUser<ProductDto>(token, {
    method: 'PUT',
    path: `/products/${encodeURIComponent(productId)}/photo`,
    organizationId,
    rawBody: { data: photo, contentType: photo.type },
  });
  if (!result.ok) console.error('Photo non enregistrée', productId, result);
  return result.ok;
}

const PHOTO_INVALID: FormState = {
  status: 'error',
  message: 'Vérifiez les champs indiqués.',
  fieldErrors: { photo: 'Photo trop lourde ou format non pris en charge.' },
};

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const photo = photoOf(formData);
  if (photo === 'invalid') return PHOTO_INVALID;
  const parsed = parseValues(createProductSchema, {
    ...productValues(formData, shop.currency),
    initialStock: optionalQuantityField(formData, 'initialStock'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<ProductDto>(shop.token, {
    method: 'POST',
    path: '/products',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  const photoSaved =
    !photo ||
    (await uploadPhoto(shop.token, shop.organizationId, result.data.id, photo));
  redirect(
    `/espace/produits/${result.data.id}${photoSaved ? '' : '?photo=echec'}`,
  );
}

export async function updateProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const id = text(formData, 'productId');
  const photo = photoOf(formData);
  if (photo === 'invalid') return PHOTO_INVALID;
  const parsed = parseValues(updateProductSchema, {
    ...productValues(formData, shop.currency),
    version: Number(text(formData, 'version')),
  });
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<ProductDto>(shop.token, {
    method: 'PATCH',
    path: `/products/${encodeURIComponent(id)}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);

  let photoSaved = true;
  if (photo) {
    photoSaved = await uploadPhoto(shop.token, shop.organizationId, id, photo);
  } else if (formData.get('removePhoto') === 'on') {
    const removed = await apiAsUser<ProductDto>(shop.token, {
      method: 'DELETE',
      path: `/products/${encodeURIComponent(id)}/photo`,
      organizationId: shop.organizationId,
    });
    photoSaved = removed.ok;
  }
  redirect(`/espace/produits/${id}${photoSaved ? '' : '?photo=echec'}`);
}

/** Archive or restore, from the product page. */
export async function setProductStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const id = text(formData, 'productId');
  const status = text(formData, 'status');
  const parsed = parseValues(updateProductSchema, {
    status,
    version: Number(text(formData, 'version')),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ProductDto>(shop.token, {
    method: 'PATCH',
    path: `/products/${encodeURIComponent(id)}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message:
      status === 'archived'
        ? 'Produit archivé : il n’apparaît plus dans la liste.'
        : 'Produit remis en vente.',
  };
}

// ---------------------------------------------------------------------------
// Stock
// ---------------------------------------------------------------------------

export async function recordMovement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const id = text(formData, 'productId');
  const kind = text(formData, 'kind');
  const reason = text(formData, 'reason').trim();
  const clientOperationId = text(formData, 'clientOperationId');
  const values =
    kind === 'purchase'
      ? {
          kind,
          quantity: quantityField(formData, 'quantity'),
          unitCost: optionalAmountField(formData, 'unitCost', shop.currency),
          supplierId: optionalIdField(formData, 'supplierId'),
          clientOperationId,
        }
      : kind === 'loss'
        ? {
            kind,
            quantity: quantityField(formData, 'quantity'),
            reason,
            clientOperationId,
          }
        : {
            kind,
            countedQuantity: quantityField(formData, 'countedQuantity'),
            reason: reason === '' ? null : reason,
            clientOperationId,
          };
  const parsed = parseValues(createStockMovementSchema, values);
  if (!parsed.ok) return parsed.state;

  const result = await apiAsUser<RecordedStockMovementDto>(shop.token, {
    method: 'POST',
    path: `/products/${encodeURIComponent(id)}/movements`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  const { product } = result.data;
  return {
    status: 'success',
    message: `Enregistré. Il reste maintenant ${formatQuantity(product.stockQuantity, product.unit)}.`,
  };
}

// ---------------------------------------------------------------------------
// Reference lists
// ---------------------------------------------------------------------------

type ReferenceKind = 'category' | 'supplier' | 'taxRate';

const REFERENCE = {
  category: {
    path: '/product-categories',
    create: createCategorySchema,
    update: updateCategorySchema,
  },
  supplier: {
    path: '/suppliers',
    create: createSupplierSchema,
    update: updateSupplierSchema,
  },
  taxRate: {
    path: '/tax-rates',
    create: createTaxRateSchema,
    update: updateTaxRateSchema,
  },
} as const;

function referenceValues(kind: ReferenceKind, formData: FormData) {
  const values: Record<string, unknown> = {};
  for (const key of ['name', 'color', 'phone', 'notes', 'status']) {
    if (formData.has(key)) values[key] = text(formData, key);
  }
  if (kind === 'taxRate' && formData.has('rate')) {
    // Typed as a percentage (« 18 », « 5,5 »), stored in basis points.
    const rate = optionalQuantityField(formData, 'rate');
    values.rateBasisPoints =
      rate === null ? Number.NaN : Math.round(rate * 100);
  }
  return values;
}

/** The rate is typed as `rate` and validated as `rateBasisPoints`. */
function withRateField(state: FormState): FormState {
  const rateError = state.fieldErrors?.rateBasisPoints;
  return rateError
    ? { ...state, fieldErrors: { ...state.fieldErrors, rate: rateError } }
    : state;
}

const CREATED: Record<ReferenceKind, string> = {
  category: 'Catégorie ajoutée.',
  supplier: 'Fournisseur ajouté.',
  taxRate: 'Taxe ajoutée.',
};

export async function createReference(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const kind = text(formData, 'kind') as ReferenceKind;
  const reference = REFERENCE[kind];
  if (!reference) return { status: 'error', message: 'Liste inconnue.' };
  const parsed = parseValues(reference.create, referenceValues(kind, formData));
  if (!parsed.ok) return withRateField(parsed.state);
  const result = await apiAsUser<CategoryDto | SupplierDto | TaxRateDto>(
    shop.token,
    {
      method: 'POST',
      path: reference.path,
      organizationId: shop.organizationId,
      body: parsed.data,
    },
  );
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: CREATED[kind] };
}

export async function updateReference(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const kind = text(formData, 'kind') as ReferenceKind;
  const reference = REFERENCE[kind];
  if (!reference) return { status: 'error', message: 'Liste inconnue.' };
  const parsed = parseValues(reference.update, referenceValues(kind, formData));
  if (!parsed.ok) return withRateField(parsed.state);
  const result = await apiAsUser<CategoryDto | SupplierDto | TaxRateDto>(
    shop.token,
    {
      method: 'PATCH',
      path: `${reference.path}/${encodeURIComponent(text(formData, 'id'))}`,
      organizationId: shop.organizationId,
      body: parsed.data,
    },
  );
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Modification enregistrée.' };
}

// ---------------------------------------------------------------------------
// Selling units and unit templates (ADR-038)
// ---------------------------------------------------------------------------

const checked = (formData: FormData, name: string) =>
  formData.get(name)?.toString() === 'on';

export async function addProductUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const productId = text(formData, 'productId');
  const parsed = parseValues(createProductUnitSchema, {
    label: text(formData, 'label'),
    factor: quantityField(formData, 'factor'),
    salePrice: optionalAmountField(formData, 'salePrice', shop.currency),
    allowsDecimals: checked(formData, 'allowsDecimals'),
    barcode: text(formData, 'barcode'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ProductDto>(shop.token, {
    method: 'POST',
    path: `/products/${encodeURIComponent(productId)}/units`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Unité « ${parsed.data.label} » ajoutée : elle est proposée à la caisse.`,
  };
}

/** Changes the price of a selling unit, or takes it off sale. */
export async function updateProductUnit(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const productId = text(formData, 'productId');
  const unitId = text(formData, 'unitId');
  const archive = text(formData, 'intent') === 'archive';
  const parsed = parseValues(updateProductUnitSchema, {
    ...(archive
      ? { status: 'archived' }
      : {
          salePrice: optionalAmountField(formData, 'salePrice', shop.currency),
        }),
    version: Number(text(formData, 'version')),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<ProductDto>(shop.token, {
    method: 'PATCH',
    path: `/products/${encodeURIComponent(productId)}/units/${encodeURIComponent(unitId)}`,
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: archive
      ? 'Unité retirée : elle n’est plus proposée à la caisse.'
      : 'Prix enregistré.',
  };
}

export async function createUnitTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const parsed = parseValues(createUnitTemplateSchema, {
    label: text(formData, 'label'),
    stockUnit: text(formData, 'stockUnit'),
    factor: quantityField(formData, 'factor'),
    allowsDecimals: checked(formData, 'allowsDecimals'),
    clientOperationId: text(formData, 'clientOperationId'),
  });
  if (!parsed.ok) return parsed.state;
  const result = await apiAsUser<UnitTemplateDto>(shop.token, {
    method: 'POST',
    path: '/unit-templates',
    organizationId: shop.organizationId,
    body: parsed.data,
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return {
    status: 'success',
    message: `Modèle « ${parsed.data.label} » ajouté.`,
  };
}

export async function archiveUnitTemplate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const shop = await shopOf(formData);
  if (!shop.ok) return shop.error;
  const id = text(formData, 'templateId');
  const result = await apiAsUser<UnitTemplateDto>(shop.token, {
    method: 'PATCH',
    path: `/unit-templates/${encodeURIComponent(id)}`,
    organizationId: shop.organizationId,
    body: { status: 'archived' },
  });
  if (!result.ok) return apiErrorState(result);
  refresh();
  return { status: 'success', message: 'Modèle retiré.' };
}
