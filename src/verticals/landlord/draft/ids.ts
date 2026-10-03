// Row ids for the form. The time only makes ids unlikely to repeat across page
// loads; it never feeds a number the owner sees.

let idCounter = 0;
export function newRowId(): string {
  idCounter += 1;
  // eslint-disable-next-line no-restricted-globals -- an id, never a number the owner sees
  return `row-${Date.now().toString(36)}-${idCounter}`;
}
