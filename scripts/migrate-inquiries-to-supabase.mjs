import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION?.trim() || "2026-01-01";
const sourceDataset = process.env.SANITY_PRODUCTION_DATASET?.trim() || "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const apply = process.argv.includes("--apply");
const validStatuses = new Set(["new", "contacted", "quoted", "confirmed", "completed", "cancelled"]);

if (!projectId || !supabaseUrl || !serviceRoleKey) {
  console.error("Set NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const source = createSanityClient({ projectId, dataset: sourceDataset, apiVersion, useCdn: true });
const target = createSupabaseClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const sourceRecords = await source.fetch(`*[_type == "inquiry"] {
  _id, _createdAt, name, email, phone, experienceId, preferredDate, groupSize, language, interests,
  message, consentGiven, source, leadChannel, status, submittedAt,
  "legacyExperienceId": experience._ref,
  "experienceSlug": coalesce(experienceSlug, experience->slug.current),
  "experienceTitle": coalesce(experienceTitle, experience->title.en, experience->title.id)
}`);

const sourceIds = sourceRecords.map((record) => record._id).filter(Boolean);
const existingIds = new Set();
for (let offset = 0; offset < sourceIds.length; offset += 100) {
  const batch = sourceIds.slice(offset, offset + 100);
  const { data, error } = await target
    .from("crm_leads")
    .select("legacy_source_id")
    .in("legacy_source_id", batch);
  if (error) throw new Error(`Could not inspect Supabase migration state: ${error.message}`);
  for (const row of data ?? []) existingIds.add(row.legacy_source_id);
}

function cleanDate(value) {
  if (typeof value !== "string") return null;
  const date = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function cleanGroupSize(value) {
  const size = Number(value);
  return Number.isSafeInteger(size) && size > 0 ? size : null;
}

function cleanText(value) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

const migrationRecords = sourceRecords
  .filter((record) => record._id && !existingIds.has(record._id))
  .map((record) => {
    const submittedAt = new Date(record.submittedAt || record._createdAt || Date.now());
    return {
      legacy_source_id: record._id,
      name: cleanText(record.name),
      email: cleanText(record.email),
      phone: cleanText(record.phone),
      experience_id: cleanText(record.experienceId || record.legacyExperienceId),
      experience_slug: cleanText(record.experienceSlug),
      experience_title: cleanText(record.experienceTitle),
      preferred_date: cleanDate(record.preferredDate),
      group_size: cleanGroupSize(record.groupSize),
      language: cleanText(record.language),
      interests: cleanText(record.interests),
      message: cleanText(record.message),
      consent_given: Boolean(record.consentGiven),
      source: cleanText(record.source) || "legacy-production",
      channel: record.leadChannel === "whatsapp" ? "whatsapp" : "form",
      status: validStatuses.has(record.status) ? record.status : "new",
      submitted_at: Number.isNaN(submittedAt.getTime()) ? new Date().toISOString() : submittedAt.toISOString(),
    };
  });

console.log(`Source inquiries in Sanity production: ${sourceRecords.length}`);
console.log(`Already copied to Supabase: ${existingIds.size}`);
console.log(`Ready to copy: ${migrationRecords.length}`);
console.log("Sanity source records are never deleted by this script.");

if (!apply) {
  console.log("Dry run only. Pass --apply to copy records into Supabase.");
  process.exit(0);
}

for (let offset = 0; offset < migrationRecords.length; offset += 100) {
  const batch = migrationRecords.slice(offset, offset + 100);
  const { error } = await target.from("crm_leads").upsert(batch, {
    onConflict: "legacy_source_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Could not copy migration batch: ${error.message}`);
}

console.log(`Copied ${migrationRecords.length} inquiry records to Supabase.`);
console.log("Verify the private CRM copies before separately authorizing any removal of the public Sanity originals.");
