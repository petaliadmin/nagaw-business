import { csvDownload } from '../download';

/** End of year statement as CSV, for the accountant. */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get('year') ?? '';
  const year = /^\d{4}$/.test(asked) ? asked : '';
  return csvDownload(
    `/accounting/statement.csv?${new URLSearchParams({ year })}`,
    `etat-fin-exercice-${year || 'invalide'}.csv`,
  );
}
