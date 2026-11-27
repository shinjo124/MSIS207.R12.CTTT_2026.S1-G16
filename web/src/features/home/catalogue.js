import { apiRequest } from '../../lib/api.js';

// One shared request for all destinations (provinces and catalogue spots with photos).
let cataloguePromise = null;
export function loadCatalogue() {
  if (!cataloguePromise) {
    cataloguePromise = apiRequest('/destinations?scope=all').then((result) => result.data || []).catch((error) => { cataloguePromise = null; throw error; });
  }
  return cataloguePromise;
}

