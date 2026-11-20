// Takes a full-screen picture of each Power BI report.
// Links and the picture key come from GitHub Secrets, so they are never visible in this file.
//   PBI_TV1, PBI_TV2 ... PBI_TV20 ... -> img/tv1-KEY.png, tv2-KEY.png ...
//   PBI_ROTATE (one link per line) -> img/rot1-KEY.png, rot2..., rot3... (for rotate.html)
const { chromium } = require('playwright');
const fs = require('fs');

// Reads PBI_TV1, PBI_TV2 ... PBI_ROTATE and SHOT_KEY from the timer file's env lines.
let S = {};
try { S = JSON.parse(process.env.ALL_SECRETS || '{}'); } catch (e) {}
Object.keys(process.env).filter(k => /^PBI_TV\d+$/.test(k) || /^PBI_ROT_\w+$/.test(k) || k === 'PBI_ROTATE' || k === 'SHOT_KEY').forEach(k => { if (!S[k] && process.env[k]) S[k] = process.env[k]; });
const KEY = S.SHOT_KEY;
const jobs = [];
Object.keys(S).filter(k => /^PBI_TV\d+$/.test(k)).sort((a, b) => a.length - b.length || a.localeCompare(b)).forEach(k => {
  const url = (S[k] || '').trim();
  if (url) jobs.push({ name: 'tv' + k.slice(6), url });
});
(S.PBI_ROTATE || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  .forEach((url, i) => jobs.push({ name: 'rot' + (i + 1), url }));
// Group revolvers: PBI_ROT_34 (one link per line) -> img/r34-1-KEY.png, r34-2-KEY.png ...
Object.keys(S).filter(k => /^PBI_ROT_\w+$/.test(k)).sort().forEach(k => {
  const g = 'r' + k.slice(8).toLowerCase();
  (S[k] || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    .forEach((url, i) => jobs.push({ name: g + '-' + (i + 1), url }));
});
// The same dashboard can appear in several places: photograph it once, then copy the picture.
const firstByUrl = {};
const unique = [], copies = [];
jobs.forEach(j => { if (firstByUrl[j.url]) copies.push({ from: firstByUrl[j.url], to: j.name }); else { firstByUrl[j.url] = j.name; unique.push(j); } });

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
  for (let i = 0; i < unique.length; i += BATCH) {
    const results = await Promise.all(unique.slice(i, i + BATCH).map(j => shoot(browser, j)));
    ok += results.filter(Boolean).length;
  }
  await browser.close();
  copies.forEach(c => {
    const from = `_site/img/${c.from}-${KEY}.png`;
    if (fs.existsSync(from)) { fs.copyFileSync(from, `_site/img/${c.to}-${KEY}.png`); console.log(c.to + ': copied from ' + c.from); }
  });
  console.log(ok + ' of ' + unique.length + ' dashboards photographed');
  if (ok === 0) process.exit(1);
})();
