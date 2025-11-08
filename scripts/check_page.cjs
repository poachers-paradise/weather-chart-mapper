const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
  const url = 'https://poachers-paradise.github.io/weather-chart-mapper/';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => {
    try {
      logs.push({ type: msg.type(), text: msg.text() });
    } catch (e) { logs.push({ type: 'unknown', text: String(msg) }); }
  });
  page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));
  page.on('requestfailed', req => logs.push({ type: 'requestfailed', url: req.url(), errorText: req.failure && req.failure.errorText }));

  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => logs.push({ type: 'goto-error', text: e.message }));

  // wait a bit for app to hydrate
  await new Promise(res => setTimeout(res, 1500));

  const rootHtml = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.slice(0, 2000) : null;
  });

  const title = await page.title();
  const screenshotPath = 'screenshots/chart_live_check.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });

  await browser.close();

  const out = { url, title, rootHtml, logs, screenshotPath };
  fs.writeFileSync('scripts/check_page_result.json', JSON.stringify(out, null, 2));
  console.log('Wrote scripts/check_page_result.json and saved screenshot to', screenshotPath);
})();
