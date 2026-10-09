/**
 * CBMonitor 手机端布局验证（2026-09-27）
 *
 * 用法：
 *   NODE_PATH="C:/Users/milan/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules" \
 *     node D:/Study/CBMonitor/tools/test_mobile.js
 *
 * 验证 4 件事：
 *   1. 页面无横向溢出（documentElement.scrollWidth <= innerWidth）
 *   2. 顶栏在窄屏换行（.top-center 的 top 大于 .top-left 的 top），且标题不竖排
 *   3. 表格保持可读宽度、横向滚动交给 .table-area（.table-area.scrollWidth > clientWidth）
 *   4. sticky 表头仍锚定在 .table-area 上（滚动后 thead th 的 top ≈ 容器 top）
 *
 * ⚠️ 对应 docs/004 §3.5 的布局铁律：表格中间层容器不能加 overflow-x:auto。
 */
const { chromium } = require('playwright');

const EXE = 'C:/Users/milan/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe';
const URL = process.env.CB_URL || 'https://9eastray.com/cb/';

const DEVICES = [
  { name: 'iPhone12', w: 390, h: 844 },
  { name: 'SE', w: 375, h: 667 },
  { name: 'Android', w: 360, h: 640 },
  { name: 'Old320', w: 320, h: 568 },
  { name: 'iPhone14Pro', w: 393, h: 852 },
  { name: 'Desktop', w: 1440, h: 900 },
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const results = [];

  for (const d of DEVICES) {
    const isMobile = d.w < 700;
    const ctx = await browser.newContext({
      viewport: { width: d.w, height: d.h },
      deviceScaleFactor: 2,
      isMobile,
      hasTouch: isMobile,
    });
    const page = await ctx.newPage();

    let hasTable = true;
    let frozenInfo = null;
    try {
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('table.cb-table', { timeout: 60000 });
    } catch (e) {
      hasTable = false;
    }
    await page.waitForTimeout(500);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const q = (s) => document.querySelector(s);
      const box = (s) => {
        const el = q(s);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const ta = q('.table-area');
      const table = q('.cb-table');
      return {
        scrollW: de.scrollWidth,
        innerW: window.innerWidth,
        scrollH: de.scrollHeight,
        innerH: window.innerHeight,
        topBar: box('.top-bar'),
        topLeft: box('.top-left'),
        topCenter: box('.top-center'),
        topRight: box('.top-right'),
        title: box('.title'),
        tableArea: ta ? { clientW: ta.clientWidth, scrollW: ta.scrollWidth, top: Math.round(ta.getBoundingClientRect().top) } : null,
        tableW: table ? Math.round(table.getBoundingClientRect().width) : null,
        rows: document.querySelectorAll('.cb-table tbody tr').length,
      };
    });

    // sticky 表头 + 冻结列验证
    let stickyOk = null;
    let frozenOk = null;
    if (m.tableArea && m.tableArea.scrollW > m.tableArea.clientW) {
      await page.evaluate(() => {
        const ta = document.querySelector('.table-area');
        ta.scrollTop = 300;
        ta.scrollLeft = 260;
      });
      await page.waitForTimeout(250);
      const s = await page.evaluate(() => {
        const ta = document.querySelector('.table-area');
        const taRect = ta.getBoundingClientRect();
        // ⚠️ 必须跳过 display:none 的列（窄屏隐藏了序号列），否则取到的是隐藏元素、rect 全 0
        const visible = (el) => el && getComputedStyle(el).display !== 'none';
        const th = Array.from(document.querySelectorAll('.cb-table thead th')).find(visible);
        const row = document.querySelector('.cb-table tbody tr');
        const tds = row ? Array.from(row.querySelectorAll('td')).filter(visible) : [];
        const codeTd = tds[0];
        const nameTd = tds[1];
        const cs = codeTd ? getComputedStyle(codeTd) : null;
        const seqTh = document.querySelector('.cb-table thead th');
        return {
          taTop: Math.round(taRect.top),
          taLeft: Math.round(taRect.left),
          thTop: th ? Math.round(th.getBoundingClientRect().top) : null,
          codeLeft: codeTd ? Math.round(codeTd.getBoundingClientRect().left) : null,
          nameLeft: nameTd ? Math.round(nameTd.getBoundingClientRect().left) : null,
          codePos: cs ? cs.position : null,
          seqHidden: seqTh ? getComputedStyle(seqTh).display === 'none' : null,
        };
      });
      stickyOk = Math.abs(s.thTop - s.taTop) <= 2;
      // 冻结生效：代码列左缘贴住容器左缘；名称列在其右侧约 58px 处
      if (s.codePos === 'sticky') {
        frozenOk = Math.abs(s.codeLeft - s.taLeft) <= 2 &&
                   Math.abs((s.nameLeft - s.codeLeft) - 58) <= 6;
      }
      frozenInfo = { codeLeft: s.codeLeft, nameLeft: s.nameLeft, taLeft: s.taLeft, seqHidden: s.seqHidden, codePos: s.codePos };
      // 在横滚状态下截一张，直观确认冻结列是否贴住左缘
      if (isMobile) {
        await page.screenshot({ path: `D:/Study/CBMonitor/tools/shot_${d.name}_${d.w}x${d.h}_scrolled.png` });
      }
      // 复位，让截图回到初始状态（上次漏了 scrollLeft，截到了横滚后的画面）
      await page.evaluate(() => {
        const ta = document.querySelector('.table-area');
        ta.scrollTop = 0;
        ta.scrollLeft = 0;
      });
      await page.waitForTimeout(200);
    }

    // 顶栏是否换行：top-center 的 top 明显大于 top-left 的 top
    const wrapped = m.topCenter && m.topLeft ? m.topCenter.top > m.topLeft.top + 5 : null;
    // 标题是否竖排：宽度应大于高度
    const titleOk = m.title ? m.title.w > m.title.h : null;

    results.push({
      name: d.name, vp: `${d.w}x${d.h}`,
      overflowX: m.scrollW - m.innerW,
      topBarH: m.topBar ? m.topBar.h : null,
      wrapped, titleOk,
      tableW: m.tableW,
      areaClientW: m.tableArea ? m.tableArea.clientW : null,
      areaScrollW: m.tableArea ? m.tableArea.scrollW : null,
      stickyOk, frozenOk, frozenInfo, rows: m.rows, hasTable,
    });

    await page.screenshot({ path: `D:/Study/CBMonitor/tools/shot_${d.name}_${d.w}x${d.h}.png` });
    await ctx.close();
  }

  await browser.close();

  const pad = (s, n) => String(s === null ? '-' : s).padEnd(n);
  console.log('\n机型         视口        横溢  顶栏高  换行  标题OK  表宽    表区可见/内容   sticky  冻结列  行数');
  console.log('-'.repeat(104));
  for (const r of results) {
    const flag = r.overflowX <= 0 ? 'OK ' : '!! ';
    console.log(
      flag + pad(r.name, 11) + pad(r.vp, 11) +
      pad(r.overflowX, 6) + pad(r.topBarH, 8) + pad(r.wrapped, 6) + pad(r.titleOk, 8) +
      pad(r.tableW, 8) + pad(`${r.areaClientW}/${r.areaScrollW}`, 15) +
      pad(r.stickyOk, 8) + pad(r.frozenOk, 8) + pad(r.rows, 5)
    );
  }
  console.log('\n说明：横溢<=0 无横向溢出；换行/标题OK 应为 true；sticky 应为 true；表区内容宽>可见宽 表示可横向滚动。');
  console.log('冻结列（仅窄屏生效）：frozenOk 应为 true；桌面端为 null（不启用）。');
  for (const r of results) {
    if (r.frozenInfo) {
      console.log(`  ${r.name}: 容器left=${r.frozenInfo.taLeft} 代码列left=${r.frozenInfo.codeLeft} 名称列left=${r.frozenInfo.nameLeft} position=${r.frozenInfo.codePos} 序号列隐藏=${r.frozenInfo.seqHidden}`);
    }
  }
  console.log('无表格数据的机型：' + (results.filter(r => !r.hasTable).map(r => r.name).join(',') || '无'));
})();
