import type { Database as SqlDatabase } from 'sql.js';
import type { ClientRow } from '../../shared/api-types.js';

export function listClients(db: SqlDatabase, search?: string): ClientRow[] {
  const term = search?.trim();
  const params: string[] = [];
  let where = '';

  if (term) {
    where = `
      WHERE lower(c.first_name || ' ' || c.last_name) LIKE lower(?)
         OR lower(c.email) LIKE lower(?)
         OR replace(c.mobile, ' ', '') LIKE replace(?, ' ', '')
    `;
    const like = `%${term}%`;
    params.push(like, like, like);
  }

  const stmt = db.prepare(
    `
    SELECT
      c.id,
      c.first_name AS firstName,
      c.last_name AS lastName,
      c.email,
      c.mobile,
      c.created_at AS createdAt,
      COUNT(j.id) AS jobCount,
      MAX(j.inspection_date) AS lastJobDate
    FROM clients c
    LEFT JOIN jobs j ON j.client_id = c.id AND IFNULL(j.deleted_at, '') = ''
    ${where}
    GROUP BY c.id
    ORDER BY lower(c.last_name), lower(c.first_name)
    `,
  );
  stmt.bind(params);

  const rows: ClientRow[] = [];
  while (stmt.step()) {
    const row = stmt.getAsObject() as Record<string, unknown>;
    rows.push({
      id: String(row.id),
      firstName: String(row.firstName),
      lastName: String(row.lastName),
      email: row.email ? String(row.email) : '',
      mobile: row.mobile ? String(row.mobile) : '',
      createdAt: String(row.createdAt),
      jobCount: Number(row.jobCount ?? 0),
      lastJobDate: row.lastJobDate ? String(row.lastJobDate) : null,
    });
  }
  stmt.free();

  return rows;
}
