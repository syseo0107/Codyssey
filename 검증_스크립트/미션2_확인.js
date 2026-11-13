// 미션2: 영화 티어리스트를 실제 Chrome에서 써 보는 스크립트
// 사용: node m2.js <html 경로> <캡처 폴더> [추가로 시험할 제목들...]
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const file = path.resolve(process.argv[2]);
const shotDir = process.argv[3];
const extra = process.argv.slice(4);
fs.mkdirSync(shotDir, { recursive: true });
const url = 'file://' + encodeURI(file);
const out = [];
const log = (name, result) => { out.push({ name, result }); console.log(name + ' => ' + JSON.stringify(result)); };

async function tierOf(page, title) {
  return page.evaluate(t => {
    const found = [...document.querySelectorAll('.card')].filter(c => c.textContent === t);
    return found.map(c => c.closest('[data-tier]').dataset.tier);
  }, title);
}
async function clickMove(page, title, tier) {
  await page.locator('.card', { hasText: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first().click();
  if (tier === 'pool') await page.click('#pool-label'); else await page.click('.row.' + tier + ' .label');
  return tierOf(page, title);
}
async function dragMove(page, title, tier) {
  const src = page.locator('.card', { hasText: new RegExp('^' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first();
  const dst = tier === 'pool' ? page.locator('#pool') : page.locator('.row.' + tier + ' .drop');
  await src.dragTo(dst);
  return tierOf(page, title);
}

(async () => {
  const userDir = fs.mkdtempSync('/tmp/m2-profile-');
  const ctx = await chromium.launchPersistentContext(userDir, { channel: 'chrome', headless: true, viewport: { width: 1100, height: 1000 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.click('#reset');
  const titles = await page.$$eval('.card', cs => cs.map(c => c.textContent));
  log('처음 카드', titles);
  await page.screenshot({ path: path.join(shotDir, '01_처음.png'), fullPage: true });

  const tiers = ['S', 'A', 'B', 'C'];
  // 1회차: 누르기로 8개 모두
  for (let round = 1; round <= 2; round++) {
    await page.click('#reset');
    for (let i = 0; i < titles.length; i++) {
      const t = tiers[i % 4];
      log(`[누르기 ${round}회차] ${titles[i]} -> ${t}`, await clickMove(page, titles[i], t));
    }
    if (round === 1) await page.screenshot({ path: path.join(shotDir, '02_누르기_8개.png'), fullPage: true });
  }
  for (let round = 1; round <= 2; round++) {
    await page.click('#reset');
    for (let i = 0; i < titles.length; i++) {
      const t = tiers[i % 4];
      log(`[끌어놓기 ${round}회차] ${titles[i]} -> ${t}`, await dragMove(page, titles[i], t));
    }
    if (round === 1) await page.screenshot({ path: path.join(shotDir, '03_끌어놓기_8개.png'), fullPage: true });
  }
  // 되돌리기(미분류)
  await page.click('#reset');
  log('기생충 S로', await clickMove(page, '기생충', 'S'));
  log('기생충 미분류로(누르기)', await clickMove(page, '기생충', 'pool'));
  log('기생충 A로(끌기)', await dragMove(page, '기생충', 'A'));
  log('기생충 미분류로(끌기)', await dragMove(page, '기생충', 'pool'));

  // 추가 제목 시험
  await page.click('#reset');
  for (const t of extra) {
    await page.fill('#title', t);
    await page.click('button[type=submit]');
    const msg = await page.textContent('#message');
    const cards = await page.$$eval('.card', cs => cs.map(c => c.textContent));
    log(`[추가] "${t}" 안내`, msg);
    log(`[추가] "${t}" 카드 존재`, cards.includes(t));
    if (cards.includes(t)) {
      log(`[추가] "${t}" 누르기 -> S`, await clickMove(page, t, 'S'));
      log(`[추가] "${t}" 끌어놓기 -> B`, await dragMove(page, t, 'B'));
    }
  }
  if (extra.length) await page.screenshot({ path: path.join(shotDir, '04_추가제목.png'), fullPage: true });
  log('카드 수 / 제목 중복 여부', await page.$$eval('.card', cs => ({ n: cs.length, dup: cs.length !== new Set(cs.map(c => c.textContent)).size })));

  // 빈 입력
  const before = await page.$$eval('.card', cs => cs.length);
  await page.fill('#title', ''); await page.click('button[type=submit]');
  log('빈 제목: 안내 / 카드 수 변화', [await page.textContent('#message'), (await page.$$eval('.card', cs => cs.length)) - before]);
  await page.fill('#title', '   '); await page.click('button[type=submit]');
  log('공백 제목: 안내 / 카드 수 변화', [await page.textContent('#message'), (await page.$$eval('.card', cs => cs.length)) - before]);

  // 다시 열기
  await page.click('#reset');
  await clickMove(page, '기생충', 'S'); await clickMove(page, '범죄도시', 'B');
  await page.fill('#title', '괴물'); await page.click('button[type=submit]');
  await clickMove(page, '괴물', 'A');
  const snap = async () => page.$$eval('.card', cs => cs.map(c => c.textContent + '@' + c.closest('[data-tier]').dataset.tier).sort());
  const s1 = await snap();
  await page.reload();
  const s2 = await snap();
  log('다시 열기 전후 배치 동일', JSON.stringify(s1) === JSON.stringify(s2));
  await page.close();
  const page2 = await ctx.newPage();
  await page2.goto(url);
  const s3 = await page2.$$eval('.card', cs => cs.map(c => c.textContent + '@' + c.closest('[data-tier]').dataset.tier).sort());
  log('탭 닫고 다시 연 뒤 배치 동일', JSON.stringify(s1) === JSON.stringify(s3));

  // 처음으로
  await page2.click('#reset');
  log('처음으로 뒤', await page2.$$eval('.card', cs => cs.map(c => c.textContent + '@' + c.closest('[data-tier]').dataset.tier)));

  // 좁은 화면
  for (const w of [1100, 420, 360, 320]) {
    await page2.setViewportSize({ width: w, height: 800 });
    const r = await page2.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth }));
    log(`폭 ${w}px 가로 넘침`, r.scrollW > r.clientW ? `넘침 ${r.scrollW}>${r.clientW}` : '없음');
    if (w === 360) await page2.screenshot({ path: path.join(shotDir, '05_좁은화면_360.png') });
  }
  // 외부 요청
  const html = fs.readFileSync(file, 'utf8');
  log('외부 주소(http) 참조 수', (html.match(/https?:\/\//g) || []).length);
  log('콘솔·페이지 오류', errors);
  fs.writeFileSync(path.join(shotDir, 'test_log.json'), JSON.stringify(out, null, 2));
  await ctx.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
