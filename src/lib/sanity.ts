import "server-only";

import { createClient, type SanityClient } from "@sanity/client";

// Read-only, best-effort helper for the Pricing page's Sanity/CRM slug diff.
// No write path or required action in this app depends on Sanity.
let publicClient: SanityClient | undefined;

function projectConfiguration() {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const productionDataset = process.env.SANITY_PRODUCTION_DATASET?.trim() || "production";
  const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-01-01";

  if (!projectId) throw new Error("NEXT_PUBLIC_SANITY_PROJECT_ID is required.");
  return { projectId, productionDataset, apiVersion };
}
export const isContentSanityConfigured = Boolean(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim());

export function contentSanity(): SanityClient {
  if (publicClient) return publicClient;
  const { projectId, productionDataset, apiVersion } = projectConfiguration();
  publicClient = createClient({
    projectId,
    dataset: productionDataset,
    apiVersion,
    useCdn: true,
  });
  return publicClient;
}
