import { expect, test } from "@playwright/test";

const dashboardUrl = "http://localhost:3215";
const websiteUrl = "http://localhost:3216";

test("CRM blocks unauthenticated access and shows its setup state", async ({ page }) => {
  await page.goto(`${dashboardUrl}/`);
  await expect(page).toHaveURL(`${dashboardUrl}/sign-in?setup=supabase`);
  await expect(page.getByRole("heading", { name: "Dashboard belum terhubung." })).toBeVisible();
});

test("website inquiry shows a save error instead of pretending it was stored", async ({ page }) => {
  await page.goto(`${websiteUrl}/id/plan-your-visit`);
  await page.getByLabel("Nama Lengkap").fill("Playwright smoke test");
  await page.getByLabel("Nomor WhatsApp").fill("5550000000");
  await page.getByRole("checkbox", { name: /Saya setuju SAGOTRA/ }).check();
  await page.getByRole("button", { name: "Kirim Pertanyaan" }).click();
  await expect(page.getByText("Pertanyaan belum terkirim", { exact: true })).toBeVisible();
});

test("website displays CRM sale prices and ignores placeholder prices", async ({ page }) => {
  await page.goto(`${websiteUrl}/id/experiences`);
  await expect(page.getByText(/123\.456/).first()).toBeVisible();
  await expect(page.getByText(/Rp\s*0\b/).first()).toBeVisible();
  await expect(page.getByText("Harga tersedia setelah konfirmasi").first()).toBeVisible();
  await expect(page.getByText(/445\.000/)).toHaveCount(0);
});

test("WhatsApp intent rejects cross-origin requests without writing to Supabase", async ({ request }) => {
  const response = await request.post(`${websiteUrl}/api/inquiry-intent`, {
    headers: { Origin: "https://untrusted.example" },
    data: { source: "/id/experiences/test" },
  });
  expect(response.status()).toBe(403);
});
