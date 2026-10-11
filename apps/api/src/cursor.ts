/** Decode only the canonical ISO/UUID format emitted by history pagination. */
export function decodeCursor(cursor: string): { date: string; id: string } {
  if (cursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(cursor))
    throw new Error('Invalid cursor encoding.');
  const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  if (
    !value ||
    typeof value.date !== 'string' ||
    !Number.isFinite(Date.parse(value.date)) ||
    new Date(value.date).toISOString() !== value.date ||
    typeof value.id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)
  )
    throw new Error('Invalid cursor value.');
  return { date: value.date, id: value.id };
}
