/**
 * CBMonitor 三个 Tab 的手机端验证（2026-09-27）
 *
 * 背景：「全部转债」Tab 的表格包在 .table-area 里（可滚动），
 *       但「A/B 策略集」Tab 的 CBTable 原先直接挂在 .main-content 下（overflow:hidden），
 *       表格加了 min-width 后会溢出且无法滚动 —— 本次修复后应三个 Tab 都能滚。
 *
 * 用法：
 *   NODE_PATH="C:/Users/milan/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules" \
 *     node D:/Study/CBMonitor/tools/test_mobile_tabs.js
 */
const { chromium } = require('playwright');

const EXE = 'C:/Users/milan/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const URL = process.env.CB_URL || 'https://9eastray.com/cb/';

async function measure(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const ta = document.querySelector('.table-area');
    const table = document.querySelector('.cb-table');
    const visible = (el) => el && getComputedStyle(el).display !== 'none';
    const row = document.querySelector('.cb-table tbody tr');
    const tds = row ? Array.from(row.querySelectorAll('td')).filter(visible) : [];
    const codeTd = tds[0];
    const nameTd = tds[1];
    return {
      overflowX: de.scrollWidth - window.innerWidth,
      hasArea: !!ta,
      areaW: ta ? `${ta.clientWidth}/${ta.scrollWidth}` : null,
      areaH: ta ? `${ta.clientHeight}/${ta.scrollHeight}` : null,
      canScrollX: ta ? ta.scrollWidth > ta.clientWidth : null,
      canScrollY: ta ? ta.scrollHeight > ta.clientHeight : null,
      tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
      rows: document.querySelectorAll('.cb-table tbody tr').length,
      codePos: codeTd ? getComputedStyle(codeTd).position : null,
      nameShadow: nameTd ? getComputedStyle(nameTd).boxShadow : null,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('table.cb-table', { timeout: 60000 });
  await page.waitForTimeout(500);
  console.log('=== Tab: 全部转债 ===');
  console.log(JSON.stringify(await measure(page)));

  // A 策略集 → 双低
  await page.getByRole('button', { name: 'A策略集' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '双低', exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('\n=== Tab: A策略集 / 双低 ===');
  console.log(JSON.stringify(await measure(page)));
  await page.screenshot({ path: 'D:/Study/CBMonitor/tools/shot_tab_lao.png' });

  // B 策略集 → 微盘转债
  await page.getByRole('button', { name: 'B策略集' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '微盘转债' }).click();
  await page.waitForTimeout(3000);
  console.log('\n=== Tab: B策略集 / 微盘转债 ===');
  console.log(JSON.stringify(await measure(page)));
  await page.screenshot({ path: 'D:/Study/CBMonitor/tools/shot_tab_jgb.png' });

  // 子按钮栏是否换行（.strategy-tabs 的高度 > 单行高度说明换行）
  const tabsH = await page.evaluate(() => {
    const el = document.querySelector('.strategy-tabs');
    if (!el) return null;
    const btns = Array.from(el.querySelectorAll('button'));
    const tops = [...new Set(btns.map(b => Math.round(b.getBoundingClientRect().top)))];
    return { height: Math.round(el.getBoundingClientRect().height), rows: tops.length, btnCount: btns.length };
  });
  console.log('\nB策略集子按钮栏：' + JSON.stringify(tabsH));

  await browser.close();
  console.log('\n判定：hasArea 应为 true；canScrollX 应为 true（26列必然超出）；overflowX 应为 0。');
})();
