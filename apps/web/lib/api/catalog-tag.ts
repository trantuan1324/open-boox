// Every apiPublic fetch carries this tag. Revalidating it also refreshes /plans and categories — harmless
// over-invalidation, chosen on purpose over separate tags (spec §4.9).
export const CATALOG_TAG = 'catalog';
