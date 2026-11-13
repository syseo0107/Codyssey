// 미션6·7: 두 AI가 만든 "우리 둘의 영화 티어리스트"를 Chrome에서 같은 방법으로 써 보는 스크립트
// 사용: node m6.js <A|B|F> <html 경로> <캡처 폴더>
const { chromium } = require('playwright-core');
const path = require('path'); const fs = require('fs');
const kind = process.argv[2]; const file = path.resolve(process.argv[3]); const dir = process.argv[4];
fs.mkdirSync(dir, { recursive: true });
const url = 'file://' + encodeURI(file);

const CFG = {
  A: { // Claude가 만든 구조 (최종본 F도 같은 구조)
    openAdd: '#btn-add', aTitle: '#a-title', aDate: '#a-release', aPoster: '#a-poster', aSubmit: '#add-form button[type=submit]', aError: '#a-error', addWin: '#add-overlay',
    card: '.card', cTitle: '.card-title', cDate: '.card-date', cAvg: '.card-avg', tierName: '.tier-name span:first-child',
    dWin: '#detail-overlay', dTitle: '#d-title', dDate: '#d-release', dPoster: '#d-poster', dMy: '#d-my-rating', dPartner: '#d-partner-rating', dMyC: '#d-my-comment', dPartnerC: '#d-partner-comment',
    dWatched: '#d-watched', dP1: '#d-photo1', dP2: '#d-photo2', dFood: '#d-food', dMemory: '#d-memory', dTier: '#d-tier', dSave: '#detail-form button[type=submit]', dError: '#d-error', dDelete: '#d-delete', dDeleteYes: '#d-confirm-yes', dClose: '#d-foot [data-close]',
    openTiers: '#btn-tiers', tInputs: '#tier-list input', tDeletes: '#tier-list li button', tNew: '#t-new', tAdd: '#tier-add-form button[type=submit]', tClose: '#tiers-overlay .modal-foot [data-close]', tWin: '#tiers-overlay',
  },
  B: { // GPT가 만든 구조
    openAdd: '#openAddBtn', aTitle: '#addTitle', aDate: '#addReleaseDate', aPoster: '#addPosterUrl', aSubmit: '#addForm button[type=submit]', aError: '#addError', addWin: '#addModal',
    card: '.movie-card', cTitle: '.card-title', cDate: '.card-meta', cAvg: '.card-rating', tierName: '.tier-header h2',
    dWin: '#detailModal', dTitle: '#detailTitle', dDate: '#detailReleaseDate', dPoster: '#detailPosterUrl', dMy: '#detailMyRating', dPartner: '#detailPartnerRating', dMyC: '#detailMyComment', dPartnerC: '#detailPartnerComment',
    dWatched: '#detailWatchedDate', dP1: '#detailPhoto1', dP2: '#detailPhoto2', dFood: '#detailFood', dMemory: '#detailMemory', dTier: '#detailTier', dSave: '#detailForm button[type=submit]', dError: null, dDelete: '#deleteMovieBtn', dDeleteYes: null, dClose: '[data-close=detailModal]',
    openTiers: '#openTierBtn', tInputs: '#tierSettingList input', tDeletes: '#tierSettingList .btn.danger', tNew: '#newTierName', tAdd: '#addTierBtn', tClose: '[data-close=tierModal]', tWin: '#tierModal',
  },
};
CFG.F = CFG.A;
const C = CFG[kind];
const out = [];
const log = (n, r) => { out.push({ name: n, result: r }); console.log(n + ' => ' + JSON.stringify(r)); };
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const board = p => p.evaluate(C => [...document.querySelectorAll('section.tier')].map(s => ({
  티어: s.querySelector(C.tierName)?.textContent, 머리글: (s.querySelector('h2')?.textContent || '').trim(),
  카드: [...s.querySelectorAll(C.card)].map(c => [c.querySelector(C.cTitle)?.textContent, c.querySelector(C.cDate)?.textContent, c.querySelector(C.cAvg)?.textContent].join(' | ')) })), C);
const where = async (p, title) => (await board(p)).filter(t => t.카드.some(c => c.startsWith(title + ' |'))).map(t => t.티어);
const cardOf = (p, title) => p.locator(C.card).filter({ has: p.locator(C.cTitle, { hasText: new RegExp('^' + esc(title) + '$') }) }).first();
const cardText = async (p, title) => (await board(p)).flatMap(t => t.카드).find(c => c.startsWith(title + ' |'));
const visible = (p, sel) => p.locator(sel).first().isVisible();
async function add(p, title, date, poster) {
  await p.click(C.openAdd);
  await p.fill(C.aTitle, title); if (date) await p.fill(C.aDate, date); if (poster) await p.fill(C.aPoster, poster);
  await p.click(C.aSubmit); await p.waitForTimeout(80);
  const open = await visible(p, C.addWin); const err = (await p.textContent(C.aError)) || '';
  if (open) { await p.keyboard.press('Escape'); if (await visible(p, C.addWin)) await p.locator(C.addWin + ' [data-close]').first().click(); }
  return { 창이닫힘: !open, 안내: err };
}
async function openDetail(p, title) { await cardOf(p, title).click(); await p.waitForTimeout(80); }
async function saveDetail(p) { await p.click(C.dSave); await p.waitForTimeout(80); const open = await visible(p, C.dWin); const err = C.dError ? await p.textContent(C.dError) : ''; return { 창이닫힘: !open, 안내: err || '' }; }
async function closeDetail(p) { if (await visible(p, C.dWin)) await p.locator(C.dClose).first().click(); }
const readDetail = p => p.evaluate(C => { const v = s => document.querySelector(s).value; return { 제목: v(C.dTitle), 개봉일: v(C.dDate), 포스터: v(C.dPoster), 내평점: v(C.dMy), 애인평점: v(C.dPartner), 내한줄평: v(C.dMyC), 애인한줄평: v(C.dPartnerC), 본날짜: v(C.dWatched), 사진1: v(C.dP1), 사진2: v(C.dP2), 음식: v(C.dFood), 추억: v(C.dMemory), 티어: document.querySelector(C.dTier).selectedOptions[0]?.textContent }; }, C);
async function rate(p, title, my, partner) { await openDetail(p, title); await p.selectOption(C.dMy, my); await p.selectOption(C.dPartner, partner); await saveDetail(p); return (await cardText(p, title)).split(' | ')[2]; }

(async () => {
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync('/tmp/m6-'), { channel: 'chrome', headless: true, viewport: { width: 1200, height: 2000 } });
  const p = ctx.pages()[0]; const errors = []; const requests = []; const dialogs = [];
  const wire = pg => {
    pg.on('pageerror', e => errors.push(String(e)));
    pg.on('request', r => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
    pg.on('dialog', async d => { dialogs.push(d.type() + ': ' + d.message()); await d.accept(); });
  };
  wire(p);
  // 시험용 그림 주소: 실제 인터넷 대신 작은 그림을 돌려준다. bad 주소는 실패시킨다.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR4nGP4z8Dwn4EBTCAwAEbVA/2Aq2PoAAAAAElFTkSuQmCC', 'base64');
  await ctx.route('https://img.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
  await ctx.route('https://bad.test/**', r => r.abort());
  await p.goto(url);
  log('1. 처음 화면 티어 칸', (await board(p)).map(t => t.머리글));
  log('1. 처음 카드 수', await p.locator(C.card).count());
  log('1. 맨 위 버튼', await p.$$eval('header button', b => b.map(x => x.textContent.trim())));
  await p.screenshot({ path: dir + '/01_처음.png', clip: { x: 0, y: 0, width: 1200, height: 1300 } });

  // 2. 등록
  log('2. 파묘(2024-02-22) 등록', await add(p, '파묘', '2024-02-22'));
  log('2. 파묘 카드(제목 | 개봉일 | 평점)와 위치', [await cardText(p, '파묘'), await where(p, '파묘')]);
  const five = [['서울의 봄', '2023-11-22'], ['헤어질 결심', '2022-06-29'], ['엘리멘탈', '2023-06-14'], ['범죄도시4', '2024-04-24']];
  for (const [t, d] of five) await add(p, t, d);
  log('2. 5편 등록 뒤 카드 수', await p.locator(C.card).count());
  // 3. 빈 제목
  let n = await p.locator(C.card).count();
  log('3. 제목 비우고 등록', await add(p, '', '2024-01-01')); log('3. 띄어쓰기만 넣고 등록', await add(p, '   ', ''));
  log('3. 카드 수 변화', (await p.locator(C.card).count()) - n);
  // 4. 고치기
  await openDetail(p, '서울의 봄');
  await p.fill(C.dTitle, '서울의 봄 (비 오던 날)'); await p.fill(C.dDate, '2023-11-23'); await p.fill(C.dPoster, 'https://img.test/poster.png');
  log('4. 제목·개봉일·포스터 주소 고치고 저장', await saveDetail(p));
  log('4. 고친 뒤 카드', await cardText(p, '서울의 봄 (비 오던 날)'));
  log('4. 카드에 포스터 그림이 보이는가', await cardOf(p, '서울의 봄 (비 오던 날)').locator('img').evaluateAll(i => i.map(x => x.complete && x.naturalWidth > 0)));
  // 포스터 없음 / 불러오기 실패
  log('4. 포스터 주소 없는 카드의 포스터 자리 글자', (await cardOf(p, '파묘').locator('.poster').innerText()).trim());
  await openDetail(p, '엘리멘탈'); await p.fill(C.dPoster, 'https://bad.test/none.jpg'); await saveDetail(p); await p.waitForTimeout(400);
  log('4. 불러오지 못하는 포스터 주소: 포스터 자리 글자 / 깨진 그림 수', [(await cardOf(p, '엘리멘탈').locator('.poster').innerText()).trim(), await cardOf(p, '엘리멘탈').locator('img').count()]);
  // 5. 기록 저장
  await openDetail(p, '파묘');
  await p.selectOption(C.dMy, '5'); await p.selectOption(C.dPartner, '4');
  await p.fill(C.dMyC, '무서운데 또 보고 싶다'); await p.fill(C.dPartnerC, '후반이 아쉬웠다'); await p.fill(C.dWatched, '2024-03-01');
  await p.fill(C.dP1, 'https://img.test/photo1.png'); await p.fill(C.dP2, 'https://img.test/photo2.png');
  await p.fill(C.dFood, '팝콘과 떡볶이'); await p.fill(C.dMemory, '영화 끝나고 비가 와서 우산 하나를 같이 썼다');
  await p.setViewportSize({ width: 1200, height: 900 }); await p.screenshot({ path: dir + '/02_상세창_입력.png' }); await p.setViewportSize({ width: 1200, height: 2000 });
  log('5. 기록 넣고 저장', await saveDetail(p));
  await openDetail(p, '파묘'); log('5. 다시 연 상세 창', await readDetail(p)); await closeDetail(p);
  log('5. 사진 주소를 넣는 칸 수', await p.locator(C.dP1 + ',' + C.dP2).count());
  // 6. 평균
  log('6. 내 5 + 애인 4', (await cardText(p, '파묘')).split(' | ')[2]);
  log('6. 내 4 + 애인 4', await rate(p, '헤어질 결심', '4', '4'));
  log('6. 내 3 + 애인 없음', await rate(p, '범죄도시4', '3', ''));
  log('6. 내 없음 + 애인 2', await rate(p, '엘리멘탈', '', '2'));
  log('6. 내 1 + 애인 2', await rate(p, '서울의 봄 (비 오던 날)', '1', '2'));
  log('6. 평점을 다시 비움', await rate(p, '엘리멘탈', '', ''));
  // 7. 옮기기
  const tiers0 = (await board(p)).map(t => t.티어);
  await cardOf(p, '파묘').dragTo(p.locator('section.tier').nth(0)); await p.waitForTimeout(150);
  log('7. 파묘를 첫 티어로 끌어 놓음', await where(p, '파묘'));
  log('7. 끌어 놓은 직후 상세 창이 열렸는가', await visible(p, C.dWin)); await closeDetail(p);
  await cardOf(p, '헤어질 결심').dragTo(p.locator('section.tier').nth(1)); await p.waitForTimeout(150);
  log('7. 헤어질 결심을 둘째 티어로 끌어 놓음', await where(p, '헤어질 결심')); await closeDetail(p);
  await openDetail(p, '범죄도시4'); await p.selectOption(C.dTier, { label: tiers0[2] }); await saveDetail(p);
  log('7. 범죄도시4를 상세 창에서 셋째 티어로', await where(p, '범죄도시4'));
  await cardOf(p, '파묘').dragTo(p.locator('section.tier').last()); await p.waitForTimeout(150);
  log('7. 파묘를 다시 아직 안 정한 영화로 끌어 놓음', await where(p, '파묘')); await closeDetail(p);
  await cardOf(p, '파묘').dragTo(p.locator('section.tier').nth(0)); await p.waitForTimeout(150); await closeDetail(p);
  log('7. 카드 총수(5여야 함)', await p.locator(C.card).count());
  await openDetail(p, '파묘'); log('7. 끌어 옮긴 뒤 상세 창의 티어 표시', (await readDetail(p)).티어); await closeDetail(p);
  await p.screenshot({ path: dir + '/03_옮긴뒤.png', clip: { x: 0, y: 0, width: 1200, height: 1300 } });
  // 8. 티어 설정
  await p.click(C.openTiers);
  await p.locator(C.tInputs).nth(0).fill('둘 다 인생작'); await p.waitForTimeout(80);
  log('8. 첫 티어 이름을 바꾼 직후 화면', (await board(p)).map(t => t.티어));
  await p.fill(C.tNew, '다시는 안 볼'); await p.click(C.tAdd); await p.waitForTimeout(80);
  log('8. 티어 추가 직후 화면', (await board(p)).map(t => t.티어));
  await p.setViewportSize({ width: 1200, height: 900 }); await p.screenshot({ path: dir + '/04_티어설정.png' }); await p.setViewportSize({ width: 1200, height: 2000 });
  const before = await where(p, '헤어질 결심');
  await p.locator(C.tDeletes).nth(1).click(); await p.waitForTimeout(100);
  log('8. 헤어질 결심이 있던 둘째 티어 삭제: 전 → 후 위치', [before, await where(p, '헤어질 결심')]);
  log('8. 삭제 뒤 화면 티어 / 카드 총수', [(await board(p)).map(t => t.티어), await p.locator(C.card).count()]);
  await p.locator(C.tInputs).nth(1).fill(''); await p.waitForTimeout(80); await p.keyboard.press('Tab');
  log('8. 티어 이름을 모두 지웠을 때 화면', (await board(p)).map(t => t.티어));
  await p.locator(C.tInputs).nth(1).fill('무난함'); await p.waitForTimeout(80);
  await p.locator(C.tClose).first().click();
  // 9. 다시 열기
  const snap = JSON.stringify(await board(p));
  await openDetail(p, '파묘'); const d1 = JSON.stringify(await readDetail(p)); await closeDetail(p);
  await p.reload(); log('9. 새로 고침 뒤 화면이 같은가', snap === JSON.stringify(await board(p)));
  await openDetail(p, '파묘'); log('9. 새로 고침 뒤 파묘 기록이 같은가', d1 === JSON.stringify(await readDetail(p))); await closeDetail(p);
  await ctx.close();
  const ctx2 = await chromium.launchPersistentContext(fs.readdirSync('/tmp').filter(f => f.startsWith('m6-')).map(f => '/tmp/' + f).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0], { channel: 'chrome', headless: true, viewport: { width: 1200, height: 2000 } });
  await ctx2.route('https://img.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: png })); await ctx2.route('https://bad.test/**', r => r.abort());
  const q = ctx2.pages()[0]; wire(q); await q.goto(url);
  log('9. 브라우저를 껐다 켠 뒤 화면이 같은가', snap === JSON.stringify(await board(q)));
  await openDetail(q, '파묘'); log('9. 껐다 켠 뒤 파묘 기록이 같은가', d1 === JSON.stringify(await readDetail(q))); await closeDetail(q);
  log('9. 다시 연 화면', await board(q));
  // 10. 좁은 화면
  const measure = () => q.evaluate(C => ({ 가로넘침: document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth + '>' + innerWidth : '없음',
    화면밖요소: [...document.querySelectorAll('button, input, select, textarea, h1, h2, ' + C.card)].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map(e => (e.id || e.className || e.tagName) + '').slice(0, 6) }), C);
  await q.setViewportSize({ width: 360, height: 740 });
  log('10. 폭 360px 본 화면', await measure()); await q.screenshot({ path: dir + '/05_좁은화면_360.png' });
  await openDetail(q, '파묘'); log('10. 폭 360px 상세 창', await measure());
  log('10. 폭 360px 상세 창에서 저장 버튼까지 갈 수 있는가', await q.locator(C.dSave).evaluate(b => { b.scrollIntoView(); const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }));
  await q.screenshot({ path: dir + '/06_좁은화면_상세창.png' }); await closeDetail(q);
  await q.click(C.openTiers); log('10. 폭 360px 티어 설정 창', await measure()); await q.locator(C.tClose).first().click();
  await q.setViewportSize({ width: 1200, height: 2000 });
  // 11. 그 밖에 써 본 것
  await openDetail(q, '범죄도시4'); await q.fill(C.dTitle, ''); log('11. 상세 창에서 제목을 지우고 저장', await saveDetail(q));
  await closeDetail(q); log('11. 그 뒤 카드 제목들', (await board(q)).flatMap(t => t.카드).map(c => c.split(' | ')[0]));
  if (!(await cardText(q, '범죄도시4'))) { await q.locator(C.card).filter({ hasText: '제목 없음' }).first().click(); await q.fill(C.dTitle, '범죄도시4'); await saveDetail(q); }
  await openDetail(q, '범죄도시4'); await q.fill(C.dPoster, 'http://img.test/a.png'); await q.fill(C.dP1, 'photo.jpg');
  log('11. https가 아닌 주소(http://, photo.jpg)를 넣고 저장', await saveDetail(q)); await closeDetail(q);
  await openDetail(q, '범죄도시4'); log('11. 그 뒤 저장된 포스터·사진 주소', [(await readDetail(q)).포스터, (await readDetail(q)).사진1]);
  await q.fill(C.dPoster, ''); await q.fill(C.dP1, ''); await saveDetail(q); await closeDetail(q);
  await openDetail(q, '파묘');
  log('11. 상세 창에 넣은 사진이 그림으로 보이는가(그림 수)', await q.locator(C.dWin + ' img').count());
  await q.fill(C.dFood, '바꾼 음식'); await q.keyboard.press('Escape'); await q.waitForTimeout(100);
  log('11. 고치다가 Esc: 창이 닫혔는가', !(await visible(q, C.dWin))); await closeDetail(q);
  await openDetail(q, '파묘'); log('11. 저장 안 하고 닫은 뒤 음식 칸', (await readDetail(q)).음식); await closeDetail(q);
  n = await q.locator(C.card).count(); dialogs.length = 0;
  await openDetail(q, '엘리멘탈'); await q.click(C.dDelete); await q.waitForTimeout(100);
  const asked = C.dDeleteYes ? await visible(q, C.dDeleteYes) : dialogs.length > 0;
  log('11. 삭제를 누르면 한 번 더 묻는가', [asked, C.dDeleteYes ? (await q.textContent('#d-confirm-text')) : dialogs[0]]);
  if (C.dDeleteYes) await q.click(C.dDeleteYes); await q.waitForTimeout(100);
  log('11. 삭제 뒤 카드 수 변화', (await q.locator(C.card).count()) - n);
  await add(q, '파묘', '2024-02-22'); log('11. 같은 제목 파묘를 한 번 더 등록한 뒤 파묘 카드 수', (await board(q)).flatMap(t => t.카드).filter(c => c.startsWith('파묘 |')).length);
  await add(q, '아주 긴 제목의 영화: 세상에서 가장 길고 긴 부제가 붙은 이야기 그리고 또 다른 이야기', '2025-01-01');
  await q.setViewportSize({ width: 360, height: 740 }); log('11. 긴 제목 등록 뒤 폭 360px', await measure()); await q.setViewportSize({ width: 1200, height: 2000 });
  await q.screenshot({ path: dir + '/07_마지막.png', clip: { x: 0, y: 0, width: 1200, height: 1300 } });
  const html = fs.readFileSync(file, 'utf8');
  log('12. 파일이 불러온 외부 주소(시험용 그림 주소 제외)', [...new Set(requests)].filter(u => !/img\.test|bad\.test/.test(u)));
  log('12. HTML 안의 link·script src·@import·url( 수', [(html.match(/<link\b/g) || []).length, (html.match(/<script[^>]+src=/g) || []).length, (html.match(/@import/g) || []).length, (html.match(/url\(/g) || []).length]);
  log('12. 페이지 오류', errors);
  fs.writeFileSync(dir + '/test_log.json', JSON.stringify(out, null, 2)); await ctx2.close();
})().catch(e => { console.error('FATAL', e); fs.writeFileSync(dir + '/test_log.json', JSON.stringify(out, null, 2)); process.exit(1); });
