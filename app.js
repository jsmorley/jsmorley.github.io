/* Static GitHub Pages app. No backend, credentials, or build step required. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  let source = window.HOMEPAGE_PUBLISHED || window.HOMEPAGE_SEED;
  let expectedPublished = clone(window.HOMEPAGE_PUBLISHED || null);
  let localHelper = false;
  const sourceJSON = JSON.stringify(source);
  let hash = 0;
  for (let i = 0; i < sourceJSON.length; i++) hash = ((hash << 5) - hash + sourceJSON.charCodeAt(i)) | 0;
  const base = String(hash);
  let state = clone(source), database, editing = false, editorDevice = false, organizing = false, formAction, imageValue, focusBefore;
  const storageKey = 'jsmorley-homepage-v1';
  const safeURL = value => {
    if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f]/.test(value)) return false;
    try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
  };
  const safeImage = value => typeof value === 'string' && (!value || /^Images\/[a-z0-9_. -]+$/i.test(value) || /^data:image\/(png|jpeg|gif|webp|avif|bmp);base64,[a-z0-9+/=\s]+$/i.test(value) || safeURL(value));
  const uid = () => 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const page = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { id = ''; }
    return state.pages.find(p => p.id === id) || state.pages.find(p => p.id === state.home);
  };
  function element(tag, text, className) {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (className) e.className = className;
    return e;
  }
  function button(text, action, className) {
    const b = element('button', text, className); b.type = 'button'; b.addEventListener('click', action); return b;
  }
  function status(text) { $('save-status').textContent = text; }
  function report(error) { status(error.message); $('notice').hidden = false; $('notice').textContent = error.message; }
  const run = action => (...args) => Promise.resolve().then(() => action(...args)).catch(report);
  function validState(s) {
    if (!s || s.version !== 1 || !Array.isArray(s.pages) || !s.pages.length || s.pages.length > 500 || !s.pages.some(p => p.id === s.home)) throw Error('This is not a valid homepage backup.');
    const ids = new Set();
    for (const p of s.pages) {
      if (!p || typeof p.id !== 'string' || ids.has(p.id) || typeof p.title !== 'string' || !Array.isArray(p.items) || p.items.length > 5000 || (p.backImage && !safeImage(p.backImage))) throw Error('Invalid folder data.');
      ids.add(p.id);
      const itemIds = new Set();
      for (const i of p.items) {
        if (!i || typeof i.id !== 'string' || itemIds.has(i.id) || typeof i.title !== 'string' || !safeImage(i.image)) throw Error('Invalid item data.');
        itemIds.add(i.id);
        if (i.links) {
          if (!Array.isArray(i.links) || i.links.length > 100 || i.links.some(l => typeof l.title !== 'string' || !safeURL(l.url))) throw Error('Invalid text links.');
        } else if (!i.folder && !safeURL(i.url)) throw Error('Links must use HTTP or HTTPS.');
      }
    }
    for (const p of s.pages) for (const i of p.items) if (i.folder && !ids.has(i.folder)) throw Error('A folder link points to a missing page.');
    return s;
  }
  async function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(storageKey, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('settings');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(Error('Close other editor tabs to enable local saving.'));
    });
  }
  async function dbRead() {
    return new Promise((resolve, reject) => {
      const request = database.transaction('settings').objectStore('settings').get('draft');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  }
  async function persist(next) {
    const record = { base, state: next, expectedPublished };
    if (database) {
      await new Promise((resolve, reject) => {
        const tx = database.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(record, 'draft');
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Saving was interrupted.'));
      });
    } else {
      try { localStorage.setItem(storageKey, JSON.stringify(record)); }
      catch { throw Error('Browser storage is unavailable or full. Export a backup before closing this tab.'); }
    }
  }
  async function commit(next) {
    validState(next);
    try { await persist(next); }
    catch (error) { throw Error('Changes were not saved. ' + error.message); }
    state = next; render(); status('Saved on this browser · Export for GitHub to update other devices');
  }
  function linkFor(item) { return item.folder ? '#' + encodeURIComponent(item.folder) : item.url; }
  function render() {
    const p = page();
    document.title = p.title;
    $('page-label').textContent = p.title;
    $('toolbar').hidden = !editing;
    $('open-editor').hidden = editing || !editorDevice;
    $('open-editor').href = 'http://localhost:4000/editor.html';
    $('grid').classList.toggle('organizing', organizing);
    $('organize').textContent = organizing ? 'Done organizing' : 'Organize';
    $('grid').replaceChildren();
    $('grid').setAttribute('aria-label', p.title);
    if (p.id !== state.home) {
      const tile = element('article', undefined, 'tile back');
      const a = element('a'); a.href = '#' + encodeURIComponent(p.parent || state.home); a.setAttribute('aria-label', 'Back to parent folder');
      const img = element('img', undefined, 'tile-image'); img.src = p.backImage || 'Images/home.jpg'; img.alt = 'Back'; a.append(img); tile.append(a); $('grid').append(tile);
    }
    for (const item of p.items) {
      const tile = element('article', undefined, 'tile'); tile.dataset.id = item.id;
      if (item.links && !item.image) {
        const links = element('div', undefined, 'text-links');
        item.links.forEach((link, n) => {
          const row = element('div', undefined, 'text-link');
          const a = element('a', link.title); a.href = link.url; row.append(a);
          if (editing && !organizing) { const b = button('…', () => editItem(item, n), 'more'); b.setAttribute('aria-label', 'Edit ' + link.title); row.append(b); }
          links.append(row);
        }); tile.append(links);
      } else {
        const a = element('a'); a.href = linkFor(item);
        if (item.image) { const img = element('img', undefined, 'tile-image'); img.src = item.image; img.alt = item.title; a.append(img); }
        else { const placeholder = element('div', item.folder ? '📁' : '↗', 'tile-image'); placeholder.style.fontSize = '80px'; a.append(placeholder); }
        a.append(element('p', item.title)); tile.append(a);
        if (editing && !organizing) { const b = button('…', () => editItem(item), 'more'); b.setAttribute('aria-label', 'Edit ' + item.title); tile.append(b); }
      }
      if (organizing) {
        const controls = element('div', undefined, 'reorder-controls');
        const handle = button('⠿ Drag', () => {}, 'drag-handle'); handle.setAttribute('aria-label', 'Drag ' + item.title + ' to reorder');
        handle.addEventListener('pointerdown', event => beginDrag(event, tile, item.id));
        const before = button('←', run(() => move(item.id, -1))); before.setAttribute('aria-label', 'Move ' + item.title + ' earlier'); before.disabled = p.items.indexOf(item) === 0;
        const after = button('→', run(() => move(item.id, 1))); after.setAttribute('aria-label', 'Move ' + item.title + ' later'); after.disabled = p.items.indexOf(item) === p.items.length - 1;
        controls.append(before, handle, after); tile.append(controls);
        tile.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.preventDefault()));
      }
      $('grid').append(tile);
    }
  }
  async function move(id, delta) {
    const next = clone(state), items = next.pages.find(p => p.id === page().id).items;
    const index = items.findIndex(i => i.id === id), target = index + delta;
    if (target < 0 || target >= items.length) return;
    items.splice(target, 0, items.splice(index, 1)[0]); await commit(next);
    const tile = [...$('grid').children].find(t => t.dataset.id === id);
    tile?.querySelector('.drag-handle')?.focus();
  }
  function beginDrag(event, tile, id) {
    if (event.button !== 0) return;
    event.preventDefault(); const handle = event.currentTarget; handle.setPointerCapture(event.pointerId);
    let targetID, scrollTimer, lastX = event.clientX, lastY = event.clientY;
    tile.classList.add('dragging');
    function update() {
      document.querySelectorAll('.drop-target').forEach(t => t.classList.remove('drop-target'));
      const over = document.elementFromPoint(lastX, lastY)?.closest('.tile[data-id]');
      targetID = over && over.dataset.id !== id ? over.dataset.id : null;
      if (targetID) over.classList.add('drop-target');
    }
    function pointerMove(e) { lastX = e.clientX; lastY = e.clientY; update(); }
    scrollTimer = setInterval(() => { const dy = lastY < 65 ? -15 : lastY > innerHeight - 65 ? 15 : 0; if (dy) { window.scrollBy(0, dy); update(); } }, 30);
    function finish(e) {
      clearInterval(scrollTimer); handle.removeEventListener('pointermove', pointerMove); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', finish);
      tile.classList.remove('dragging'); document.querySelectorAll('.drop-target').forEach(t => t.classList.remove('drop-target'));
      if (e.type === 'pointercancel' || !targetID) return;
      const next = clone(state), items = next.pages.find(p => p.id === page().id).items;
      const from = items.findIndex(i => i.id === id), to = items.findIndex(i => i.id === targetID);
      items.splice(to, 0, items.splice(from, 1)[0]); run(() => commit(next))();
    }
    handle.addEventListener('pointermove', pointerMove); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
  }
  function openPanel(title) {
    focusBefore = document.activeElement;
    $('panel-title').textContent = title; $('fields').replaceChildren(); $('form-error').textContent = '';
    $('save').hidden = false; $('delete').hidden = true; formAction = null;
    $('save').textContent = 'Save';
    if (!$('panel').open) $('panel').showModal();
  }
  function closePanel() { $('panel').querySelectorAll('input[type="password"]').forEach(input => { input.value = ''; }); $('panel').close(); focusBefore?.isConnected && focusBefore.focus(); }
  function field(label, value = '', type = 'text') {
    const id = uid(); const l = element('label', label); l.htmlFor = id;
    const input = element('input'); input.id = id; input.type = type; input.value = value; input.required = true;
    $('fields').append(l, input); return input;
  }
  function imageField(value) {
    imageValue = value || '';
    const zone = element('div', undefined, 'drop-zone');
    const preview = element('img'); preview.alt = 'Selected image preview'; preview.hidden = !imageValue; if (imageValue) preview.src = imageValue;
    const label = element('label', 'Drop an image here, or browse'); label.htmlFor = 'image-picker';
    const picker = element('input'); picker.id = 'image-picker'; picker.type = 'file'; picker.accept = 'image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp';
    const choose = async file => {
      if (!file) return;
      if (!/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(file.type)) throw Error('Choose a PNG, JPEG, GIF, WebP, AVIF, or BMP image.');
      if (file.size > 15 * 1024 * 1024) throw Error('Choose an image smaller than 15 MB.');
      const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = () => reject(Error('Unable to read image.')); r.readAsDataURL(file); });
      const img = new Image(); img.src = data;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(Error('This browser cannot open that image.')); });
      imageValue = data; preview.src = data; preview.hidden = false; $('form-error').textContent = '';
    };
    const load = async file => {
      $('save').disabled = true;
      try { await choose(file); } catch (e) { $('form-error').textContent = e.message; }
      finally { $('save').disabled = false; }
    };
    picker.addEventListener('change', () => load(picker.files[0]));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); load(e.dataTransfer.files[0]); });
    zone.append(preview, label, picker); $('fields').append(zone);
  }
  function editItem(item, linkIndex) {
    const currentPageID = page().id;
    openPanel(item ? 'Edit ' + (item.folder ? 'folder tile' : 'item') : 'Add link');
    const link = linkIndex !== undefined ? item.links[linkIndex] : item;
    const title = field('Title', link?.title || '');
    const url = item?.folder ? null : field('URL', link?.url || '', 'text');
    if (url) { url.placeholder = 'https://example.com'; url.autocapitalize = 'off'; url.spellcheck = false; }
    imageField(linkIndex !== undefined ? '' : item?.image);
    if (item?.folder) $('fields').append(element('p', 'This tile opens its folder. Rename or delete the page using Folders.', 'help'));
    if (item) {
      $('delete').hidden = false;
      $('delete').onclick = run(async () => {
        const warning = item.folder ? 'Remove this folder tile? The page will still be available in Folders.' : 'Delete this item?';
        if (!confirm(warning)) return;
        const next = clone(state), items = next.pages.find(p => p.id === currentPageID).items, index = items.findIndex(i => i.id === item.id);
        if (linkIndex !== undefined) { items[index].links.splice(linkIndex, 1); if (!items[index].links.length) items.splice(index, 1); }
        else items.splice(index, 1);
        await commit(next); closePanel();
      });
    }
    formAction = async () => {
      if (url && !safeURL(url.value.trim())) throw Error('Enter an HTTP or HTTPS URL.');
      const next = clone(state), items = next.pages.find(p => p.id === currentPageID).items;
      if (linkIndex !== undefined) {
        const group = items.find(i => i.id === item.id);
        if (imageValue) {
          group.links.splice(linkIndex, 1);
          const index = items.indexOf(group); items.splice(index + 1, 0, { id: uid(), title: title.value.trim(), url: url.value.trim(), image: imageValue });
          if (!group.links.length) items.splice(index, 1);
        } else group.links[linkIndex] = { title: title.value.trim(), url: url.value.trim() };
      } else {
        const target = item ? items.find(i => i.id === item.id) : { id: uid() };
        Object.assign(target, { title: title.value.trim(), image: imageValue });
        if (url) target.url = url.value.trim();
        if (!item) items.push(target);
      }
      if (!title.value.trim()) throw Error('Enter a title.');
      await commit(next); closePanel();
    };
  }
  function manageFolders() {
    openPanel('Folders'); $('save').hidden = true;
    $('fields').append(element('p', 'Create a folder in the current page, or rename, open, and delete existing pages.', 'help'));
    $('fields').append(button('New folder', () => editFolder()));
    for (const p of state.pages) {
      const row = element('div', undefined, 'folder-row'); row.append(element('span', p.title));
      row.append(button('Open', () => { location.hash = encodeURIComponent(p.id); closePanel(); }));
      row.append(button('Edit', () => editFolder(p))); $('fields').append(row);
    }
  }
  function editFolder(folder) {
    const parentID = page().id;
    openPanel(folder ? 'Edit page' : 'Create folder');
    const name = field('Page name (browser tab title)', folder?.title || '');
    const tile = folder ? state.pages.flatMap(p => p.items).find(i => i.folder === folder.id) : null;
    const title = folder?.id === state.home ? null : field('Folder tile title', tile?.title || '');
    if (title) imageField(tile?.image || 'Images/NewsFolder.jpg');
    if (folder && folder.id !== state.home) {
      $('delete').hidden = false;
      $('delete').onclick = run(async () => {
        if (!confirm('Delete "' + folder.title + '" and its ' + folder.items.length + ' items? Links to this folder will also be removed.')) return;
        const next = clone(state); next.pages = next.pages.filter(p => p.id !== folder.id);
        for (const p of next.pages) { p.items = p.items.filter(i => i.folder !== folder.id); if (p.parent === folder.id) p.parent = state.home; }
        await commit(next); closePanel();
      });
    }
    formAction = async () => {
      if (!name.value.trim() || (title && !title.value.trim())) throw Error('Enter the page name and tile title.');
      const next = clone(state);
      if (folder) {
        next.pages.find(p => p.id === folder.id).title = name.value.trim();
        for (const p of next.pages) for (const i of p.items) if (i.folder === folder.id) { i.title = title.value.trim(); i.image = imageValue; }
        if (title && !tile) next.pages.find(p => p.id === parentID).items.push({ id: uid(), folder: folder.id, url: '#' + folder.id, title: title.value.trim(), image: imageValue });
      } else {
        const id = 'folder-' + uid();
        next.pages.push({ id, title: name.value.trim(), parent: parentID, backImage: 'Images/home.jpg', items: [] });
        next.pages.find(p => p.id === parentID).items.push({ id: uid(), folder: id, url: '#' + id, title: title.value.trim(), image: imageValue });
      }
      await commit(next); closePanel();
    };
  }
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = element('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function publishPanel() {
    openPanel('Publish to GitHub');
    $('save').textContent = 'Commit and publish';
    $('fields').append(element('p', 'Publish your current draft, including uploaded images, to jsmorley/jsmorley.github.io on master. GitHub Pages will update the site after deployment.', 'help'));
    if (!localHelper) {
      $('save').hidden = true;
      $('fields').append(element('p', 'Start start-local.cmd in C:\\MyHomePage on your PC, with Pageant running, then open your PC editor. It publishes using your SSH key without a token.', 'help'));
      const open = element('a', 'Open PC editor'); open.href = 'http://localhost:4000/editor.html'; $('fields').append(open);
      return;
    }
    $('fields').append(element('p', 'Connected to your PC helper. Publishing uses your GitHub SSH key through Pageant. No token needed.', 'help'));
    const message = field('Commit message', 'Update homepage bookmarks from editor');
    formAction = async () => {
      const snapshot = clone(state);
      const result = await window.HomepagePublisher.publish({ state: snapshot, expected: expectedPublished, message: message.value });
      expectedPublished = clone(snapshot); source = clone(snapshot);
      try { await persist(snapshot); } catch { /* The commit succeeded; the previously saved draft remains available. */ }
      closePanel();
      status(result.unchanged ? 'This draft is already committed to GitHub.' : 'Committed ' + result.commit.slice(0, 7) + ' to master · GitHub Pages is deploying your changes.');
      if (result.url) { const a = element('a', ' View commit'); a.href = result.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('save-status').append(a); }
    };
  }
  $('editor-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!formAction) return;
    $('save').disabled = true; $('form-error').textContent = '';
    try { await formAction(); } catch (error) { $('form-error').textContent = error.message; }
    finally { $('save').disabled = false; }
  });
  $('close').onclick = closePanel; $('cancel').onclick = closePanel;
  $('organize').onclick = () => { organizing = !organizing; render(); status(organizing ? 'Drag handles to reorder, or use the arrow buttons. Changes save automatically.' : 'Order saved on this browser'); };
  $('add-item').onclick = () => editItem(); $('manage').onclick = manageFolders;
  $('publish').onclick = publishPanel;
  $('export').onclick = () => {
    download('site-data.js', '// Published homepage data. Includes uploaded images.\nwindow.HOMEPAGE_PUBLISHED = ' + JSON.stringify(state, null, 2) + ';\n', 'text/javascript');
    status('Downloaded site-data.js · Replace this file in your GitHub repository and commit it to publish.');
  };
  $('backup').onclick = () => download('homepage-backup.json', JSON.stringify(state, null, 2), 'application/json');
  $('import').onclick = () => $('import-file').click();
  $('import-file').onchange = run(async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const next = validState(JSON.parse(await file.text()));
      if (confirm('Replace this browser’s current draft with this backup?')) await commit(next);
    } finally { e.target.value = ''; }
  });
  $('readonly').onclick = () => {
    editing = false; organizing = false;
    try { localStorage.removeItem('homepage-editor'); } catch { /* private browsing */ }
    history.replaceState(null, '', location.pathname + location.hash);
    state = clone(source); render(); $('notice').hidden = true;
  };
  window.addEventListener('hashchange', () => { organizing = false; render(); window.scrollTo(0, 0); });
  // Don't allow accidental file drops to navigate away from the editor.
  window.addEventListener('dragover', e => { if (editing) e.preventDefault(); });
  window.addEventListener('drop', e => { if (editing) e.preventDefault(); });
  async function initialize() {
    try { editing = new URLSearchParams(location.search).get('edit') === '1' || localStorage.getItem('homepage-editor') === '1'; }
    catch { editing = new URLSearchParams(location.search).get('edit') === '1'; }
    try { editorDevice = localStorage.getItem('homepage-editor-device') === '1'; } catch { /* storage unavailable */ }
    if (editing) {
      localHelper = await window.HomepagePublisher.localStatus();
      editorDevice = true;
      try { localStorage.setItem('homepage-editor', '1'); localStorage.setItem('homepage-editor-device', '1'); } catch { /* storage fallback below */ }
      let record;
      try { database = await openDB(); record = await dbRead(); }
      catch { try { record = JSON.parse(localStorage.getItem(storageKey)); } catch { /* use published data */ } }
      if (record?.base === base) {
        try { state = validState(record.state); if (Object.hasOwn(record, 'expectedPublished')) expectedPublished = record.expectedPublished; status('Local draft loaded · Publish to GitHub to update other devices'); }
        catch { status('The saved draft was unreadable. Published data loaded.'); }
      } else status(record ? 'New published version loaded. An older browser draft was not applied.' : 'Editor enabled on this browser · Edits save locally');
    }
    render();
  }
  initialize().catch(report);
})();
