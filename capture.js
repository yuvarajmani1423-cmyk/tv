// Takes a full-screen picture of each Power BI report.
// The report links and the picture key come from GitHub Secrets, so they are not visible in this file.
const { chromium } = require('playwright');
const fs = require('fs');

const KEY = process.env.SHOT_KEY;
const TVS = [
  { name: 'tv1', url: process.env.PBI_TV1 },
  { name: 'tv2', url: process.env.PBI_TV2 },
  { name: 'tv3', url: process.env.PBI_TV3 },
];

(async () => {
  if (!KEY) { console.error('SHOT_KEY secret is missing'); process.exit(1); }
  fs.mkdirSync('_site/img', { recursive: true });
  const browser = await chromium.launch();
  let ok = 0;
  for (const tv of TVS) {
    if (!tv.url) { console.log(tv.name + ': no link set, skipped'); continue; }
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    try {
      await page.goto(tv.url, { waitUntil: 'networkidle', timeout: 120000 });
      await page.waitForTimeout(25000); // give the visuals time to finish drawing
      await page.screenshot({ path: `_site/img/${tv.name}-${KEY}.png` });
      console.log(tv.name + ': picture saved');
      ok++;
    } catch (e) {
      console.error(tv.name + ': failed - ' + e.message);
    }
    await page.close();
  }
  await browser.close();
  if (ok === 0) process.exit(1);
})();
