export interface ValueSplit {
  known: Array<[string, unknown]>;
  withoutValue: string[];
}

// Los atributos null se agrupan aparte ("N sin valor") y los arrays vacíos se
// ocultan porque no aportan información. false, 0 y "" sí son valores.
export function splitValues(
  values: Record<string, unknown> | null | undefined,
): ValueSplit {
  const known: Array<[string, unknown]> = [];
  const withoutValue: string[] = [];
  for (const [k, v] of Object.entries(values ?? {})) {
    if (v === null) withoutValue.push(k);
    else if (!(Array.isArray(v) && v.length === 0)) known.push([k, v]);
  }
  return { known, withoutValue };
}
