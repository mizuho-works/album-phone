// スマホ編集版: PCのアプリで書き出した「スマホ用ファイル」を開いて、ページの
// 並べ替え・写真の差し替え・レイアウト変更・ページ数の変更をする。写真は小さな
// サムネイルだけ。結果は「案」(.json)として書き出し、PCの「案を読み込む」で戻す。
(function () {
  const LIMIT = 30; // PCアプリ(state.js)と同じ本文ページの上限
  const PAGE_HEIGHT_PT = (21 / 2.54) * 72;
  const MAX_UNDO = 50;

  // ---------- 保存(IndexedDB) ----------
  let dbp = null;
  function db() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open("albumphone", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("albums", { keyPath: "id" });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function idb(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction("albums", mode);
      const r = fn(tx.objectStore("albums"));
      tx.oncomplete = () => resolve(r && r.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  const listAlbums = () => idb("readonly", (s) => s.getAll());
  const putAlbum = (a) => idb("readwrite", (s) => s.put(a));
  const delAlbum = (id) => idb("readwrite", (s) => s.delete(id));

  // ---------- 状態 ----------
  let cur = null; // 編集中のアルバム {id,name,cover,library,pages}
  let libByName = new Map();
  let undoStack = [];
  let peIndex = -1; // ページ編集で開いているページ
  let selFrame = -1;
  let swapMode = false;
  let saveTimer = null;

  const $ = (id) => document.getElementById(id);
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 2600);
  }
  function uidFrames(n) {
    return Array.from({ length: n }, () => ({ photo: null, tx: 0, ty: 0, scale: 1 }));
  }

  // ---------- ページの種類・番号 ----------
  function layoutOf(page) {
    return window.AlbumLayouts.getLayout(page.count, page.variant || 0, !!page.spread);
  }
  function isCoverPage(page) {
    if (page.blank || page.backCover || page.spread) return false;
    const l = layoutOf(page);
    return !!(l.label && l.label.indexOf("表紙") === 0);
  }
  function insideIndex(pages) {
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.backCover || isCoverPage(p)) continue;
      return p.blank && !p.spread ? i : -1;
    }
    return -1;
  }
  // 'back' | 'cover' | 'inside' | 'body'
  function kindOf(pages, i) {
    const p = pages[i];
    if (p.backCover) return "back";
    if (isCoverPage(p)) return "cover";
    if (i === insideIndex(pages)) return "inside";
    return "body";
  }
  function bodyCount(pages) {
    return pages.reduce((n, p, i) => (kindOf(pages, i) === "body" ? n + (p.spread ? 2 : 1) : n), 0);
  }
  function labels(pages) {
    let n = 1;
    return pages.map((p, i) => {
      const k = kindOf(pages, i);
      if (k === "back") return "裏表紙";
      if (k === "cover") return "表紙";
      if (k === "inside") return "表紙裏(白紙)";
      const l = p.spread ? `p${n}-${n + 1}` : `p${n}`;
      n += p.spread ? 2 : 1;
      return l;
    });
  }

  // ---------- 描画 ----------
  function computeCoverBox(frameAspect, imgAspect, scale, tx, ty) {
    scale = Math.max(1, scale || 1);
    let baseW, baseH;
    if (imgAspect > frameAspect) {
      baseH = 100;
      baseW = 100 * (imgAspect / frameAspect);
    } else {
      baseW = 100;
      baseH = 100 * (frameAspect / imgAspect);
    }
    const wPct = baseW * scale;
    const hPct = baseH * scale;
    const posX = 50 + (tx || 0) * 50;
    const posY = 50 + (ty || 0) * 50;
    return { left: (100 - wPct) * (posX / 100), top: (100 - hPct) * (posY / 100), w: wPct, h: hPct };
  }

  function coverText(t) {
    const c = (cur && cur.cover) || {};
    if (t === "title" || t === "name") return c.title || t;
    if (t === "event") return c.event || t;
    if (t === "DDth Mon. YYYY") return c.date || t;
    return t;
  }

  // page: {count, variant, spread, frames:[{photo,tx,ty,scale}], blank, backCover}
  function renderPage(page, opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "page " + (page.spread ? "sp" : "sq");
    const bg = cur && cur.cover && cur.cover.bgColor ? "#" + cur.cover.bgColor : "#fff";
    if (page.backCover) {
      el.classList.add("fixed-note");
      el.style.background = bg;
      el.textContent = "裏表紙";
      return el;
    }
    if (page.blank) {
      el.classList.add("blankpg");
      if (opts.label) el.dataset.label = opts.label;
      return el;
    }
    const layout = layoutOf(page);
    const isCover = !page.spread && layout.label && layout.label.indexOf("表紙") === 0;
    if (isCover) el.style.background = bg;
    const pageAspect = page.spread ? 2 : 1;
    layout.frames.forEach((rect, i) => {
      const f = page.frames[i] || { photo: null };
      const fe = document.createElement("div");
      fe.className = "frame";
      fe.style.left = rect.x * 100 + "%";
      fe.style.top = rect.y * 100 + "%";
      fe.style.width = rect.w * 100 + "%";
      fe.style.height = rect.h * 100 + "%";
      fe.dataset.index = String(i);
      const photo = f.photo ? libByName.get(f.photo) : null;
      if (photo) {
        const img = document.createElement("img");
        img.src = photo.thumb;
        img.draggable = false;
        const fa = (rect.w * pageAspect) / rect.h;
        const ia = (photo.width || 3) / (photo.height || 2);
        const b = computeCoverBox(fa, ia, f.scale, f.tx, f.ty);
        img.style.left = b.left + "%";
        img.style.top = b.top + "%";
        img.style.width = b.w + "%";
        img.style.height = b.h + "%";
        // 左右反転は、枠の中身全体を枠の中心で反転する(PCのアプリと同じ見た目)
        const wrap = document.createElement("div");
        wrap.className = "photo-wrap";
        if (f.flipX) wrap.style.transform = "scaleX(-1)";
        wrap.appendChild(img);
        fe.appendChild(wrap);
      } else {
        fe.classList.add("empty");
      }
      el.appendChild(fe);
    });
    if (isCover) {
      (layout.texts || []).forEach((t) => {
        const te = document.createElement("div");
        te.className = "txt";
        te.style.left = t.x * 100 + "%";
        te.style.top = t.y * 100 + "%";
        te.style.width = t.w * 100 + "%";
        te.style.height = t.h * 100 + "%";
        te.style.color = "#" + t.color;
        te.style.fontWeight = t.bold ? "700" : "400";
        te.style.fontSize = ((t.fontPt / PAGE_HEIGHT_PT) * 100).toFixed(2) + "cqh";
        te.style.fontFamily = t.fontFamily === "Amalfi Coast" ? "'Snell Roundhand','Zapfino',cursive" : "-apple-system,sans-serif";
        te.textContent = coverText(t.text);
        el.appendChild(te);
      });
    }
    return el;
  }

  // ---------- 保存・取り消し ----------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!cur) return;
      cur.savedAt = Date.now();
      putAlbum(cur).catch((e) => console.error(e));
    }, 300);
  }
  function snapshot() {
    undoStack.push(JSON.stringify(cur.pages));
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    refreshUndo();
  }
  function refreshUndo() {
    $("btn-undo").disabled = undoStack.length === 0;
    $("pe-undo").disabled = undoStack.length === 0;
  }
  function undo() {
    if (!undoStack.length) return;
    cur.pages = JSON.parse(undoStack.pop());
    if (peIndex >= cur.pages.length) peIndex = cur.pages.length - 1;
    afterChange();
    refreshUndo();
  }
  function afterChange() {
    scheduleSave();
    renderGrid();
    if (!$("page-editor").hidden) renderPageEditor();
  }

  // ---------- ホーム ----------
  async function renderHome() {
    const albums = (await listAlbums()).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const ul = $("album-list");
    ul.innerHTML = "";
    $("album-empty").hidden = albums.length > 0;
    albums.forEach((a) => {
      const li = document.createElement("li");
      const info = document.createElement("div");
      info.className = "info";
      const d = new Date(a.savedAt || Date.now());
      info.innerHTML = '<div class="name"></div><div class="sub"></div>';
      info.querySelector(".name").textContent = a.name;
      info.querySelector(".sub").textContent = `${a.library.length}枚 / ${a.pages.length}ページ・${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      info.onclick = () => openAlbum(a);
      const open = document.createElement("button");
      open.className = "btn primary small";
      open.textContent = "開く";
      open.onclick = () => openAlbum(a);
      const del = document.createElement("button");
      del.className = "btn danger small";
      del.textContent = "削除";
      del.onclick = async () => {
        if (!confirm(`「${a.name}」をこのスマホから削除しますか?(PCのデータは消えません)`)) return;
        await delAlbum(a.id);
        renderHome();
      };
      li.append(info, open, del);
      ul.appendChild(li);
    });
  }

  async function importFile(file) {
    let pkg;
    try {
      pkg = JSON.parse(await file.text());
    } catch (e) {
      toast("ファイルを読めませんでした");
      return;
    }
    if (!pkg || pkg.format !== "albumphone" || !Array.isArray(pkg.pages) || !Array.isArray(pkg.library)) {
      toast("スマホ用ファイルではありません");
      return;
    }
    const id = "album:" + pkg.name;
    const existing = (await listAlbums()).find((a) => a.id === id);
    if (existing && !confirm(`「${pkg.name}」はすでにあります。新しいファイルで置き換えますか?\n(スマホで編集した内容は、置き換えると消えます)`)) return;
    const album = { id, name: pkg.name, cover: pkg.cover || {}, library: pkg.library, pages: pkg.pages, savedAt: Date.now() };
    await putAlbum(album);
    openAlbum(album);
  }

  // ---------- ページ一覧 ----------
  function openAlbum(album) {
    cur = album;
    libByName = new Map(cur.library.map((p) => [p.name, p]));
    undoStack = [];
    refreshUndo();
    $("album-title").textContent = cur.name;
    $("home").hidden = true;
    $("editor").hidden = false;
    renderGrid();
  }

  function renderGrid() {
    const grid = $("page-grid");
    const scrollEl = document.querySelector(".page-grid-wrap");
    const keep = scrollEl ? scrollEl.scrollTop : 0;
    grid.innerHTML = "";
    const labs = labels(cur.pages);
    cur.pages.forEach((p, i) => {
      const cell = document.createElement("div");
      cell.className = "page-cell" + (p.spread ? " spread" : "");
      const pe = renderPage(p, { label: labs[i] });
      pe.addEventListener("click", () => openPageEditor(i));
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = labs[i];
      cell.append(pe, cap);
      grid.appendChild(cell);
    });
    const add = document.createElement("button");
    add.className = "add-cell";
    add.textContent = "＋ ページを追加";
    add.onclick = addPage;
    grid.appendChild(add);
    if (scrollEl) scrollEl.scrollTop = keep;
    updateCounter();
  }

  function updateCounter() {
    const n = bodyCount(cur.pages);
    const msgs = [`本文 ${n} / ${LIMIT} ページ`];
    let warn = false;
    if (n % 2 === 1) {
      msgs.push("偶数ページにしてください(2ページ刻み)");
      warn = true;
    }
    if (n < 12) {
      msgs.push("12ページ以上が必要です");
      warn = true;
    }
    if (n > LIMIT) {
      msgs.push("上限を超えています");
      warn = true;
    }
    const c = $("counter");
    c.textContent = msgs.join(" ・ ");
    c.classList.toggle("warn", warn);
  }

  function newBodyPage() {
    return { blank: false, backCover: false, spread: false, count: 1, variant: 0, frames: uidFrames(1) };
  }
  function addPage() {
    if (bodyCount(cur.pages) + 1 > LIMIT) {
      toast(`本文の上限(${LIMIT}ページ)です`);
      return;
    }
    snapshot();
    cur.pages.push(newBodyPage());
    afterChange();
  }

  // ---------- ページ編集 ----------
  let activeTab = "photo";
  function openPageEditor(i) {
    peIndex = i;
    selFrame = cur.pages[i].frames.length === 1 && !cur.pages[i].blank && !cur.pages[i].backCover ? 0 : -1;
    swapMode = false;
    $("page-editor").hidden = false;
    renderPageEditor();
  }
  function closePageEditor() {
    $("page-editor").hidden = true;
    peIndex = -1;
    renderGrid();
  }

  function curPage() {
    return cur.pages[peIndex];
  }

  function renderPageEditor() {
    const page = curPage();
    const labs = labels(cur.pages);
    const kind = kindOf(cur.pages, peIndex);
    $("pe-title").textContent = labs[peIndex];
    $("pe-prev").disabled = peIndex <= 0;
    $("pe-next").disabled = peIndex >= cur.pages.length - 1;
    const prev = $("pe-preview");
    prev.innerHTML = "";
    const el = renderPage(page);
    el.style.touchAction = "none";
    prev.appendChild(el);
    el.querySelectorAll(".frame").forEach((fe) => {
      const idx = Number(fe.dataset.index);
      if (idx === selFrame) fe.classList.add("sel");
      if (swapMode && idx === swapSrc) fe.classList.add("swapsrc");
      attachFrameHandlers(fe, idx);
    });
    // ヒント
    let hint = "";
    if (page.backCover) hint = "裏表紙は編集できません";
    else if (page.blank) hint = "白紙のページです";
    else if (swapMode) hint = swapSrc < 0 ? "入れ替える1つ目の枠をタップ" : "入れ替える2つ目の枠をタップ";
    else if (selFrame < 0) hint = "枠をタップして選んでください";
    else hint = `枠${selFrame + 1}を選択中`;
    $("pe-hint").textContent = hint;

    const editable = kind === "body";
    const locked = page.backCover || page.blank;
    // 写真タブ
    $("btn-pick").disabled = locked;
    $("btn-swap").disabled = locked || page.frames.length < 2;
    $("btn-swap").classList.toggle("on", swapMode);
    $("btn-clear").disabled = locked;
    // 切り抜き
    const f = selFrame >= 0 ? page.frames[selFrame] : null;
    $("zoom-range").disabled = !f || !f.photo;
    $("zoom-range").value = f ? f.scale || 1 : 1;
    $("btn-crop-reset").disabled = !f || !f.photo;
    $("btn-flip").disabled = !f || !f.photo;
    $("btn-flip").classList.toggle("on", !!(f && f.flipX));
    // レイアウト
    renderLayoutPanel(page, editable);
    // ページ
    const k = kindOf(cur.pages, peIndex);
    $("btn-move-up").disabled = !editable || !movable(peIndex, -1);
    $("btn-move-down").disabled = !editable || !movable(peIndex, 1);
    $("btn-dup").disabled = !editable;
    $("btn-del").disabled = !editable;
    refreshUndo();
  }

  let swapSrc = -1;

  function attachFrameHandlers(fe, idx) {
    let start = null;
    fe.addEventListener("pointerdown", (e) => {
      const page = curPage();
      if (page.backCover || page.blank) return;
      try {
        fe.setPointerCapture(e.pointerId);
      } catch (err) {
        /* 一部の環境では使えない。動作には影響しない */
      }
      start = { x: e.clientX, y: e.clientY, moved: false, tx: null, ty: null, snap: false };
      const f = page.frames[idx];
      start.tx = f.tx || 0;
      start.ty = f.ty || 0;
    });
    fe.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) < 6) return;
      const page = curPage();
      const f = page.frames[idx];
      if (!f.photo || swapMode || idx !== selFrame) return; // 選択中の枠だけ動かせる
      start.moved = true;
      if (!start.snap) {
        snapshot();
        start.snap = true;
      }
      const r = fe.getBoundingClientRect();
      const photo = libByName.get(f.photo);
      if (!photo) return;
      const layout = layoutOf(page);
      const rect = layout.frames[idx];
      const pageAspect = page.spread ? 2 : 1;
      const fa = (rect.w * pageAspect) / rect.h;
      const ia = (photo.width || 3) / (photo.height || 2);
      const b = computeCoverBox(fa, ia, f.scale, 0, 0);
      const wPct = b.w;
      const hPct = b.h;
      let tx = start.tx;
      let ty = start.ty;
      if (wPct > 100.01) {
        const sx = f.flipX ? -1 : 1; // 反転している枠は、横の向きが逆
        const posX = 50 + start.tx * 50 + ((sx * dx / r.width) * 100 * 100) / (100 - wPct);
        tx = Math.max(-1, Math.min(1, (posX - 50) / 50));
      }
      if (hPct > 100.01) {
        const posY = 50 + start.ty * 50 + ((dy / r.height) * 100 * 100) / (100 - hPct);
        ty = Math.max(-1, Math.min(1, (posY - 50) / 50));
      }
      f.tx = tx;
      f.ty = ty;
      // 動かしている間は、この枠の画像だけ更新する
      const img = fe.querySelector("img");
      if (img) {
        const nb = computeCoverBox(fa, ia, f.scale, tx, ty);
        img.style.left = nb.left + "%";
        img.style.top = nb.top + "%";
      }
    });
    const end = () => {
      if (!start) return;
      const moved = start.moved;
      start = null;
      if (moved) {
        scheduleSave();
        return;
      }
      onFrameTap(idx);
    };
    fe.addEventListener("pointerup", end);
    fe.addEventListener("pointercancel", () => {
      start = null;
    });
  }

  function onFrameTap(idx) {
    const page = curPage();
    if (swapMode) {
      if (swapSrc < 0) {
        swapSrc = idx;
        selFrame = idx;
      } else if (swapSrc !== idx) {
        snapshot();
        const a = page.frames[swapSrc];
        const b = page.frames[idx];
        [a.photo, b.photo] = [b.photo, a.photo];
        [a.tx, b.tx] = [b.tx, a.tx];
        [a.ty, b.ty] = [b.ty, a.ty];
        [a.scale, b.scale] = [b.scale, a.scale];
        [a.flipX, b.flipX] = [!!b.flipX, !!a.flipX];
        swapMode = false;
        swapSrc = -1;
        selFrame = idx;
        scheduleSave();
        toast("入れ替えました");
      }
      renderPageEditor();
      return;
    }
    selFrame = idx;
    renderPageEditor();
  }

  // レイアウトタブ
  function variantList(count, spread) {
    return window.AlbumLayouts.getVariants(count, spread);
  }
  function renderLayoutPanel(page, editable) {
    const seg = $("count-seg");
    seg.innerHTML = "";
    for (let n = 1; n <= 6; n++) {
      const b = document.createElement("button");
      b.textContent = String(n);
      const ok = editable && variantList(n, !!page.spread).length > 0;
      b.disabled = !ok;
      if (page.count === n) b.classList.add("on");
      b.onclick = () => setCount(n);
      seg.appendChild(b);
    }
    const sp = $("btn-spread");
    sp.disabled = !editable;
    sp.classList.toggle("on", !!page.spread);
    const strip = $("variant-strip");
    strip.innerHTML = "";
    if (!editable) return;
    variantList(page.count, !!page.spread).forEach((v, i) => {
      const norm = window.AlbumLayouts.normalizeVariant(v);
      if (norm.label && norm.label.indexOf("表紙") === 0) return; // 表紙用は本文に使わない
      const btn = document.createElement("button");
      btn.className = "v" + (page.spread ? " spreadv" : "") + (page.variant === i ? " on" : "");
      const tmp = { count: page.count, variant: i, spread: !!page.spread, frames: page.frames };
      btn.appendChild(renderPage(tmp));
      btn.onclick = () => setVariant(i);
      strip.appendChild(btn);
    });
  }
  function setCount(n) {
    const page = curPage();
    if (page.count === n) return;
    snapshot();
    while (page.frames.length < n) page.frames.push({ photo: null, tx: 0, ty: 0, scale: 1 });
    page.frames = page.frames.slice(0, n);
    page.count = n;
    if ((page.variant || 0) >= variantList(n, !!page.spread).length) page.variant = 0;
    selFrame = n === 1 ? 0 : -1;
    afterChange();
  }
  function setVariant(i) {
    const page = curPage();
    if (page.variant === i) return;
    snapshot();
    page.variant = i;
    afterChange();
  }
  function toggleSpread() {
    const page = curPage();
    if (!page.spread && bodyCount(cur.pages) + 1 > LIMIT) {
      toast(`本文の上限(${LIMIT}ページ)を超えるため見開きにできません`);
      return;
    }
    if (variantList(page.count, !page.spread).length === 0) {
      toast("この枚数では見開きにできません(見開きは2・3・4・6枚)");
      return;
    }
    snapshot();
    page.spread = !page.spread;
    if ((page.variant || 0) >= variantList(page.count, page.spread).length) page.variant = 0;
    afterChange();
  }

  // ページ操作
  function movable(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= cur.pages.length) return false;
    return kindOf(cur.pages, j) === "body";
  }
  function movePage(dir) {
    if (!movable(peIndex, dir)) return;
    snapshot();
    const j = peIndex + dir;
    [cur.pages[peIndex], cur.pages[j]] = [cur.pages[j], cur.pages[peIndex]];
    peIndex = j;
    afterChange();
  }
  function dupPage() {
    const page = curPage();
    const add = page.spread ? 2 : 1;
    if (bodyCount(cur.pages) + add > LIMIT) {
      toast(`本文の上限(${LIMIT}ページ)です`);
      return;
    }
    snapshot();
    cur.pages.splice(peIndex + 1, 0, JSON.parse(JSON.stringify(page)));
    peIndex += 1;
    afterChange();
    toast("複製しました");
  }
  function delPage() {
    if (!confirm("このページを削除しますか?(取り消しで戻せます)")) return;
    snapshot();
    cur.pages.splice(peIndex, 1);
    if (peIndex >= cur.pages.length) peIndex = cur.pages.length - 1;
    selFrame = -1;
    afterChange();
    if (cur.pages.length === 0) closePageEditor();
  }

  // 写真を選ぶ
  function openPicker() {
    const page = curPage();
    if (selFrame < 0) {
      toast("先に、写真を入れる枠をタップしてください");
      return;
    }
    renderPicker();
    $("picker").hidden = false;
  }
  function usageMap() {
    const map = new Map();
    const labs = labels(cur.pages);
    cur.pages.forEach((p, i) => {
      p.frames.forEach((f) => {
        if (!f.photo) return;
        if (!map.has(f.photo)) map.set(f.photo, []);
        if (map.get(f.photo).indexOf(labs[i]) === -1) map.get(f.photo).push(labs[i]);
      });
    });
    return map;
  }
  function renderPicker() {
    const grid = $("picker-grid");
    grid.innerHTML = "";
    const use = usageMap();
    const onlyUnused = $("picker-unused").checked;
    cur.library.forEach((p) => {
      const used = use.get(p.name);
      if (onlyUnused && used) return;
      const b = document.createElement("button");
      b.className = "pk" + (used ? " used" : "");
      const img = document.createElement("img");
      img.src = p.thumb;
      img.loading = "lazy";
      b.appendChild(img);
      const nm = document.createElement("span");
      nm.className = "nm";
      nm.textContent = p.name.replace(/\.[^.]+$/, "");
      b.appendChild(nm);
      if (used) {
        const bd = document.createElement("span");
        bd.className = "badge";
        bd.textContent = used.join(" ");
        b.appendChild(bd);
      }
      b.onclick = () => placePhoto(p.name);
      grid.appendChild(b);
    });
  }
  function placePhoto(name) {
    const page = curPage();
    if (selFrame < 0) return;
    snapshot();
    const f = page.frames[selFrame];
    f.photo = name;
    f.tx = 0;
    f.ty = 0;
    f.scale = 1;
    f.flipX = false;
    $("picker").hidden = true;
    afterChange();
  }

  // ---------- PCへ送る ----------
  async function sendToPC() {
    const pages = cur.pages.map((p) => ({
      blank: !!p.blank,
      backCover: !!p.backCover,
      spread: !!p.spread,
      count: p.count,
      variant: p.variant || 0,
      frames: p.frames.map((f) => ({ photo: f.photo || null, tx: f.tx || 0, ty: f.ty || 0, scale: f.scale || 1, flipX: !!f.flipX })),
    }));
    const plan = { format: "albumplan", version: 2, full: true, name: cur.name, exportedAt: Date.now(), pages };
    const filename = `${cur.name}_案.json`;
    const file = new File([JSON.stringify(plan)], filename, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast("ファイルを保存しました。PCに送ってください");
  }

  // ---------- 配線 ----------
  function setTab(name) {
    activeTab = name;
    document.querySelectorAll("#pe-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    ["photo", "crop", "layout", "page"].forEach((t) => ($("tab-" + t).hidden = t !== name));
    if (name !== "photo") {
      swapMode = false;
      swapSrc = -1;
    }
    if (!$("page-editor").hidden) renderPageEditor();
  }

  function init() {
    $("file-input").addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f) await importFile(f);
    });
    $("btn-back").onclick = () => {
      $("editor").hidden = true;
      $("home").hidden = false;
      cur = null;
      renderHome();
    };
    $("btn-undo").onclick = undo;
    $("pe-undo").onclick = undo;
    $("btn-send").onclick = sendToPC;
    $("pe-close").onclick = closePageEditor;
    $("pe-prev").onclick = () => {
      if (peIndex > 0) {
        peIndex -= 1;
        selFrame = -1;
        swapMode = false;
        swapSrc = -1;
        openPageEditor(peIndex);
      }
    };
    $("pe-next").onclick = () => {
      if (peIndex < cur.pages.length - 1) {
        peIndex += 1;
        openPageEditor(peIndex);
      }
    };
    document.querySelectorAll("#pe-tabs button").forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
    $("btn-pick").onclick = openPicker;
    $("btn-clear").onclick = () => {
      const page = curPage();
      if (selFrame < 0) {
        toast("枠をタップして選んでください");
        return;
      }
      snapshot();
      const f = page.frames[selFrame];
      f.photo = null;
      f.tx = 0;
      f.ty = 0;
      f.scale = 1;
      f.flipX = false;
      afterChange();
    };
    $("btn-swap").onclick = () => {
      swapMode = !swapMode;
      swapSrc = -1;
      renderPageEditor();
    };
    $("zoom-range").addEventListener("input", (e) => {
      const page = curPage();
      if (selFrame < 0) return;
      const f = page.frames[selFrame];
      if (!f.photo) return;
      if (!$("zoom-range")._snap) {
        snapshot();
        $("zoom-range")._snap = true;
      }
      f.scale = Number(e.target.value);
      scheduleSave();
      renderPreviewOnly();
    });
    $("zoom-range").addEventListener("change", () => {
      $("zoom-range")._snap = false;
    });
    $("btn-flip").onclick = () => {
      const page = curPage();
      if (selFrame < 0) {
        toast("枠をタップして選んでください");
        return;
      }
      const f = page.frames[selFrame];
      if (!f.photo) return;
      snapshot();
      f.flipX = !f.flipX;
      afterChange();
    };
    $("btn-crop-reset").onclick = () => {
      const page = curPage();
      if (selFrame < 0) return;
      const f = page.frames[selFrame];
      snapshot();
      f.tx = 0;
      f.ty = 0;
      f.scale = 1;
      afterChange();
    };
    $("btn-spread").onclick = toggleSpread;
    $("btn-move-up").onclick = () => movePage(-1);
    $("btn-move-down").onclick = () => movePage(1);
    $("btn-dup").onclick = dupPage;
    $("btn-del").onclick = delPage;
    $("picker-close").onclick = () => ($("picker").hidden = true);
    $("picker-unused").onchange = renderPicker;
    $("picker").addEventListener("click", (e) => {
      if (e.target === $("picker")) $("picker").hidden = true;
    });
    renderHome();
    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  // 拡大スライダー操作中は、プレビューだけ作り直す(スライダーを壊さない)
  function renderPreviewOnly() {
    const prev = $("pe-preview");
    prev.innerHTML = "";
    const el = renderPage(curPage());
    el.style.touchAction = "none";
    prev.appendChild(el);
    el.querySelectorAll(".frame").forEach((fe) => {
      const idx = Number(fe.dataset.index);
      if (idx === selFrame) fe.classList.add("sel");
      attachFrameHandlers(fe, idx);
    });
  }

  init();
})();
