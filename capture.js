// Takes a full-screen picture of each Power BI report.
// Links and the picture key come from GitHub Secrets, so they are never visible in this file.
//   PBI_TV1, PBI_TV2, PBI_TV3 -> img/tv1-KEY.png, tv2..., tv3...
//   PBI_ROTATE (one link per line) -> img/rot1-KEY.png, rot2..., rot3... (for rotate.html)
const { chromium } = require('playwright');
const fs = require('fs');

const KEY = process.env.SHOT_KEY;
const jobs = [];
['1', '2', '3'].forEach(n => {
  const url = process.env['PBI_TV' + n];
  if (url && url.trim()) jobs.push({ name: 'tv' + n, url: url.trim() });
});
(process.env.PBI_ROTATE || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  .forEach((url, i) => jobs.push({ name: 'rot' + (i + 1), url }));

async function shoot(browser, job) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(25000); // give the visuals time to finish drawing
    await page.screenshot({ path: `_site/img/${job.name}-${KEY}.png` });
    console.log(job.name + ': picture saved');
    return true;
  } catch (e) {
    console.error(job.name + ': failed - ' + e.message);
    return false;
  } finally {
    await page.close();
  }
}

(async () => {
  if (!KEY) { console.error('SHOT_KEY secret is missing'); process.exit(1); }
  fs.mkdirSync('_site/img', { recursive: true });
  const browser = await chromium.launch();
  let ok = 0;
  const BATCH = 4; // take 4 pictures at the same time to finish faster
  for (let i = 0; i < jobs.length; i += BATCH) {
    const results = await Promise.all(jobs.slice(i, i + BATCH).map(j => shoot(browser, j)));
    ok += results.filter(Boolean).length;
  }
  await browser.close();
  console.log(ok + ' of ' + jobs.length + ' pictures saved');
  if (ok === 0) process.exit(1);
})();
