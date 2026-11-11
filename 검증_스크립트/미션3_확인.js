// 미션3: 민수_영화티어리스트.html을 실제 Chrome에서 써 보는 스크립트
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const file = path.resolve(process.argv[2]);
const shotDir = process.argv[3];
fs.mkdirSync(shotDir, { recursive: true });
const url = 'file://' + encodeURI(file);
const out = [];
const log = (name, result) => { out.push({ name, result }); console.log(name + ' => ' + JSON.stringify(result)); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const layout = page => page.evaluate(() => {
  const res = {};
  document.querySelectorAll('.tier').forEach(row => {
    res[row.querySelector('.tier-badge b').textContent] = [...row.querySelectorAll('.card')].map(c => c.textContent);
  });
  res.pool = [...document.querySelectorAll('#pool .card')].map(c => c.textContent);
  return res;
});
const card = (page, title) => page.locator('.card', { hasText: new RegExp('^' + esc(title) + '$') }).first();
const badge = (page, t) => page.locator('.tier-' + t + ' .tier-badge');
const zone = (page, t) => t === 'pool' ? page.locator('#pool') : page.locator('.tier-' + t + ' .zone');

(async () => {
  const userDir = fs.mkdtempSync('/tmp/m3-profile-');
  const ctx = await chromium.launchPersistentContext(userDir, { channel: 'chrome', headless: true, viewport: { width: 1280, height: 900 } });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url);
  log('처음 화면', await layout(page));
  log('처음 안내/통계', [await page.textContent('#status'), await page.textContent('#stat')]);
  await page.screenshot({ path: path.join(shotDir, '01_처음.png'), fullPage: true });

  // 누르기: 8개 모두
  const titles = (await layout(page)).pool;
  const tiers = ['S', 'A', 'B', 'C'];
  for (let i = 0; i < titles.length; i++) { await card(page, titles[i]).click(); await badge(page, tiers[i % 4]).click(); }
  log('누르기로 8개 옮긴 뒤', await layout(page));
  log('통계', await page.textContent('#stat'));
  await page.click('#reset');
  // 끌어 놓기: 8개 모두
  for (let i = 0; i < titles.length; i++) { await card(page, titles[i]).dragTo(zone(page, tiers[i % 4])); }
  log('끌어 놓기로 8개 옮긴 뒤', await layout(page));
  await page.screenshot({ path: path.join(shotDir, '02_끌어놓기_8개.png'), fullPage: true });
  // 한 칸에만 있는지
  log('카드 총수(8이어야 함)', await page.$$eval('.card', c => c.length));
  // 되돌리기
  await card(page, '기생충').click(); await page.click('#to-pool');
  log('기생충 되돌리기(누르기) 뒤 pool', (await layout(page)).pool);
  await card(page, '인터스텔라').dragTo(zone(page, 'pool'));
  log('인터스텔라 되돌리기(끌기) 뒤 pool', (await layout(page)).pool);
  // 카드 고른 뒤 칸의 빈 곳 누르기
  await page.click('#reset');
  await card(page, '기생충').click();
  await zone(page, 'S').click({ position: { x: 300, y: 60 } });
  log('카드 고르고 S칸 빈 곳(글자 아님)을 누름', [(await layout(page)).S, await page.textContent('#status')]);
  // 카드 안 고르고 등급 누름
  await page.click('#reset');
  await badge(page, 'A').click();
  log('카드 안 고르고 A 누름 안내', await page.textContent('#status'));

  // 추가
  await page.fill('#title', '어바웃 타임'); await page.click('button[type=submit]');
  log('어바웃 타임 추가 뒤 pool / 안내', [(await layout(page)).pool, await page.textContent('#status')]);
  await card(page, '어바웃 타임').click(); await badge(page, 'S').click();
  await card(page, '센과 치히로의 행방불명').dragTo(zone(page, 'B'));
  log('추가 영화 누르기→S, 띄어쓰기 제목 끌기→B', await layout(page));
  // 빈 제목
  let n = await page.$$eval('.card', c => c.length);
  await page.fill('#title', ''); await page.click('button[type=submit]');
  log('빈 제목 추가: 카드 수 변화 / 안내', [(await page.$$eval('.card', c => c.length)) - n, await page.textContent('#status')]);
  n = await page.$$eval('.card', c => c.length);
  await page.fill('#title', '    '); await page.click('button[type=submit]');
  log('공백만 추가: 카드 수 변화 / 안내', [(await page.$$eval('.card', c => c.length)) - n, await page.textContent('#status')]);
  log('글자 없는 카드 수', await page.$$eval('.card', cs => cs.filter(c => !c.textContent).length));
  await page.screenshot({ path: path.join(shotDir, '03_빈제목_카드.png'), fullPage: true });
  // 같은 제목 두 번
  n = await page.$$eval('.card', c => c.length);
  await page.fill('#title', '기생충'); await page.click('button[type=submit]');
  log('이미 있는 "기생충" 추가: 카드 수 변화 / 안내', [(await page.$$eval('.card', c => c.length)) - n, await page.textContent('#status')]);
  log('통계(빈 카드 포함 여부)', await page.textContent('#stat'));

  // 처음으로: 추가한 영화가 남는가
  await page.click('#reset');
  log('처음으로 뒤', await layout(page));

  // 다시 열기
  await card(page, '기생충').click(); await badge(page, 'S').click();
  await card(page, '범죄도시').dragTo(zone(page, 'B'));
  await page.fill('#title', '괴물'); await page.click('button[type=submit]');
  log('다시 열기 전', await layout(page));
  await page.screenshot({ path: path.join(shotDir, '04_다시열기_전.png'), fullPage: true });
  await page.reload();
  log('새로 고침 뒤', await layout(page));
  await page.screenshot({ path: path.join(shotDir, '05_다시열기_후.png'), fullPage: true });
  log('localStorage 항목 수', await page.evaluate(() => localStorage.length));

  // 좁은 화면
  for (const w of [1280, 1000, 768, 390, 360]) {
    await page.setViewportSize({ width: w, height: 800 });
    const r = await page.evaluate(() => {
      const pg = document.querySelector('.page').getBoundingClientRect();
      const reset = document.querySelector('#reset').getBoundingClientRect();
      const add = document.querySelector('button[type=submit]').getBoundingClientRect();
      const stat = document.querySelector('#stat').getBoundingClientRect();
      return { 창: innerWidth, 내용폭: Math.round(pg.width), 내용오른쪽끝: Math.round(pg.right), 가로스크롤가능: document.documentElement.scrollWidth > innerWidth, 추가버튼보임: add.right <= innerWidth, 처음으로버튼보임: reset.right <= innerWidth, 통계보임: stat.right <= innerWidth,
        보이는카드: [...document.querySelectorAll('.card')].filter(c => c.getBoundingClientRect().right <= innerWidth).length, 전체카드: document.querySelectorAll('.card').length };
    });
    log(`폭 ${w}px`, r);
    if (w === 390) {
      await page.screenshot({ path: path.join(shotDir, '06_좁은화면_390.png'), fullPage: true });
      await page.evaluate(() => window.scrollTo(600, 0));
      log('390px에서 오른쪽으로 스크롤 시도 후 scrollX', await page.evaluate(() => scrollX));
    }
  }
  // 끌기 거리: 미분류와 S칸의 세로 위치
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.reload();
  log('창 높이 720에서 S칸/미분류 카드 세로 위치(px)', await page.evaluate(() => ({ S칸위: Math.round(document.querySelector('.tier-S').getBoundingClientRect().top), 미분류카드위: Math.round(document.querySelector('#pool .card').getBoundingClientRect().top + scrollY), 문서높이: document.documentElement.scrollHeight, 창높이: innerHeight })));
  await page.setViewportSize({ width: 1280, height: 1100 });
  log('창 높이 1100에서 문서높이', await page.evaluate(() => ({ 문서높이: document.documentElement.scrollHeight, 창높이: innerHeight })));
  // 끌 때 칸 색
  log('카드 배경', await page.evaluate(() => getComputedStyle(document.querySelector('.card')).backgroundImage));
  const html = fs.readFileSync(file, 'utf8');
  log('외부 주소 참조 수', (html.match(/https?:\/\//g) || []).length);
  log('페이지 오류', errors);
  fs.writeFileSync(path.join(shotDir, 'test_log.json'), JSON.stringify(out, null, 2));
  await ctx.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
