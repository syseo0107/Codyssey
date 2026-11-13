// 미션6 테스트 3 · 미션7 수정 확인: 좁은 화면, 긴 제목, 불러오지 못하는 사진 주소
// 사용: node m7.js <html> <캡처 폴더>
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const file = path.resolve(process.argv[2]); const dir = process.argv[3]; fs.mkdirSync(dir, { recursive: true });
const out = []; const log = (n, r) => { out.push({ name: n, result: r }); console.log(n + ' => ' + JSON.stringify(r)); };
(async () => { const b = await chromium.launch({ channel: 'chrome', headless: true });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 1000 } });
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEklEQVR4nGP4z8Dwn4EBTCAwAEbVA/2Aq2PoAAAAAElFTkSuQmCC', 'base64');
  await ctx.route('https://img.test/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: png })); await ctx.route('https://bad.test/**', r => r.abort());
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', e => errors.push(String(e)));
  await p.goto('file://' + encodeURI(file));
  const add = async (t, d) => { await p.click('#btn-add'); await p.fill('#a-title', t); if (d) await p.fill('#a-release', d); await p.click('#add-form button[type=submit]'); };
  const LONG = '아주 긴 제목의 영화: 세상에서 가장 길고 긴 부제가 붙은 이야기 그리고 또 다른 이야기';
  await add('파묘', '2024-02-22'); await add('서울의 봄', '2023-11-22'); await add(LONG, '2025-01-01'); await add('개봉일 없는 영화', '');
  const cards = () => p.evaluate(() => [...document.querySelectorAll('.card')].map(c => { const t = c.querySelector('.poster-text'), d = c.querySelector('.card-date'), po = c.querySelector('.poster');
    const lh = parseFloat(getComputedStyle(d).lineHeight); const pr = po.getBoundingClientRect();
    // 포스터 자리 안에서 글자 줄이 반만 보이는지: 글자 상자가 잘라 낸 높이가 줄 높이의 배수가 아니면 반쯤 잘린 줄이 보인다
    let 잘린줄 = null; if (t) { const tl = parseFloat(getComputedStyle(t).lineHeight); const cs = getComputedStyle(t); const inner = t.clientHeight - parseFloat(cs.paddingTop); const visibleLines = inner / tl; 잘린줄 = t.scrollHeight > t.clientHeight + 1 && Math.abs(visibleLines - Math.round(visibleLines)) > 0.15; }
    return { 제목: c.querySelector('.card-title').textContent.slice(0, 9), 개봉일글자: d.textContent, 개봉일줄수: Math.round(d.getBoundingClientRect().height / lh), 포스터자리에_반쯤잘린줄: 잘린줄, 카드폭: Math.round(c.getBoundingClientRect().width), 화면밖: c.getBoundingClientRect().right > innerWidth + 0.5 }; }));
  for (const w of [1200, 360]) { await p.setViewportSize({ width: w, height: w === 360 ? 740 : 1000 });
    log('폭 ' + w + 'px 카드', await cards());
    log('폭 ' + w + 'px 가로 넘침', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    await p.evaluate(() => document.querySelector('.tier.unassigned').scrollIntoView());
    await p.screenshot({ path: dir + '/폭' + w + '_긴제목_개봉일.png' }); await p.evaluate(() => scrollTo(0, 0)); }
  await p.setViewportSize({ width: 1200, height: 1000 });
  // 불러오지 못하는 사진 주소
  await p.locator('.card').first().click();
  await p.fill('#d-photo1', 'https://bad.test/x.jpg'); await p.fill('#d-photo2', 'https://img.test/ok.png');
  await p.click('#detail-form button[type=submit]'); await p.waitForTimeout(100);
  await p.locator('.card').first().click(); await p.waitForTimeout(500);
  log('사진 주소 2개(1번은 불러오지 못하는 주소) 저장 뒤 상세 창', { 저장된주소: [await p.inputValue('#d-photo1'), await p.inputValue('#d-photo2')], 보이는그림수: await p.locator('#d-photo-preview img').count(), 사진자리글자: (await p.locator('#d-photo-preview').innerText()).trim() });
  await p.locator('#d-photo-preview').evaluate(e => e.scrollIntoView({ block: 'center' })); await p.screenshot({ path: dir + '/사진주소_실패.png' });
  await p.fill('#d-photo1', 'https://img.test/ok1.png'); await p.click('#detail-form button[type=submit]'); await p.locator('.card').first().click(); await p.waitForTimeout(400);
  log('두 주소 모두 되는 주소로 바꾼 뒤', { 보이는그림수: await p.locator('#d-photo-preview img').count(), 사진자리글자: (await p.locator('#d-photo-preview').innerText()).trim() });
  await p.fill('#d-photo1', ''); await p.fill('#d-photo2', ''); await p.click('#detail-form button[type=submit]'); await p.locator('.card').first().click(); await p.waitForTimeout(200);
  log('사진 주소를 모두 비운 뒤', { 보이는그림수: await p.locator('#d-photo-preview img').count(), 사진자리글자: (await p.locator('#d-photo-preview').innerText()).trim() });
  log('페이지 오류', errors);
  fs.writeFileSync(dir + '/추가확인_log.json', JSON.stringify(out, null, 2)); await b.close(); })().catch(e => { console.error('FATAL', e); process.exit(1); });
