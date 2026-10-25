import { csvDownload } from '../download';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Journal of receipts and expenses as CSV, for the accountant. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ['from', 'to']) {
    const value = params.get(key);
    if (value && DAY_RE.test(value)) query.set(key, value);
  }
  const period = [query.get('from'), query.get('to')].filter(Boolean).join('-');
  return csvDownload(
    `/accounting/journal.csv?${query}`,
    `journal-recettes-depenses${period ? `-${period}` : ''}.csv`,
  );
}
