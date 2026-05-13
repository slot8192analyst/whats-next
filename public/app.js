const API_CARDS = '/api/cards';
const API_VISITS = '/api/visits';

let cardsCache = [];
let visitsCache = [];
let pendingPick = null;

// 画像オプション(ここに追記すれば選択肢が増える)
const IMAGE_OPTIONS = [
  { value: '', label: '画像なし' },
  { value: 'cafe.png', label: 'カフェ' },
  { value: 'shopping.png', label: 'ショッピング' },
  { value: 'wapper.jpg', label: 'ハンバーガー' },
];

// ---------- ユーティリティ ----------
function populateImageSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = IMAGE_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function updateImagePreview(selectId, previewId) {
  const sel = document.getElementById(selectId);
  const img = document.getElementById(previewId);
  if (!sel || !img) return;
  if (sel.value) {
    img.src = `/images/${encodeURIComponent(sel.value)}`;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    img.src = '';
  }
}

// タグ操作
function parseTags(str) {
  if (!str) return [];
  return [...new Set(str.split(',').map(t => t.trim()).filter(Boolean))];
}

function tagsToString(tags) {
  return tags.join(', ');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- fetch ----------
async function fetchCards() {
  const res = await fetch(API_CARDS);
  cardsCache = await res.json();
}
async function fetchVisits() {
  const res = await fetch(API_VISITS);
  visitsCache = await res.json();
}

// ---------- render ----------
function renderCards() {
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  if (cardsCache.length === 0) {
    list.innerHTML = '<li style="color:var(--muted);cursor:default;">まだカードがありません</li>';
    return;
  }
  cardsCache.forEach(card => {
    const li = document.createElement('li');
    li.dataset.id = card.id;
    const thumb = card.image_key
      ? `<img class="thumb" src="/images/${encodeURIComponent(card.image_key)}" alt="">`
      : `<div class="thumb-placeholder"></div>`;
    li.innerHTML = `
      ${thumb}
      <div class="card-main">
        <div class="card-title">${escapeHtml(card.title)}</div>
        ${parseTags(card.category).length
          ? `<div class="tags">${parseTags(card.category).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
          : ''}
      </div>
      <span class="chevron">›</span>
    `;
    li.addEventListener('click', () => openDetailModal(card.id));
    list.appendChild(li);
  });
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (visitsCache.length === 0) {
    list.innerHTML = '<li style="color:var(--muted)">まだ履歴はありません</li>';
    return;
  }
  visitsCache.forEach(v => {
    const date = new Date(v.visited_at + 'Z').toLocaleString('ja-JP');
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHtml(v.title || '(削除されたカード)')}</strong>
      <div class="card-meta">${date}</div>
      <div class="row-actions"><button class="visit-delete-btn" data-id="${v.id}">削除</button></div>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.visit-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteVisit(btn.dataset.id))
  );
}

function renderTagFilter() {
  const container = document.getElementById('filter-tags');
  const previouslySelected = getSelectedTags();
  const allTags = [...new Set(cardsCache.flatMap(c => parseTags(c.category)))].sort();
  container.innerHTML = allTags.map(t => `
    <button type="button" class="tag-btn ${previouslySelected.includes(t) ? 'active' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>
  `).join('');
  container.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });
}

function getSelectedTags() {
  return [...document.querySelectorAll('#filter-tags .tag-btn.active')].map(b => b.dataset.tag);
}

// ---------- 初期化系 ----------
async function reloadAll() {
  await Promise.all([fetchCards(), fetchVisits()]);
  renderCards();
  renderHistory();
  renderTagFilter();
}

// ---------- カード追加 ----------
document.getElementById('add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    category: tagsToString(parseTags(document.getElementById('category').value)),
    created_by: document.getElementById('created_by').value,
    image_key: document.getElementById('image_key').value || null,
  };
  await fetch(API_CARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  e.target.reset();
  updateImagePreview('image_key', 'image-preview');
  reloadAll();
});

// ---------- カード削除 ----------
async function deleteCard(id) {
  if (!confirm('このカードを削除しますか?(関連する履歴も削除されます)')) return;
  await fetch(`${API_CARDS}/${id}`, { method: 'DELETE' });
  closeDetailModal();
  reloadAll();
}

// ---------- 編集モーダル ----------
function openEditModal(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;
  document.getElementById('edit-id').value = card.id;
  document.getElementById('edit-title').value = card.title || '';
  document.getElementById('edit-description').value = card.description || '';
  document.getElementById('edit-category').value = card.category || '';
  document.getElementById('edit-created_by').value = card.created_by || '';
  document.getElementById('edit-image_key').value = card.image_key || '';
  updateImagePreview('edit-image_key', 'edit-image-preview');
  document.getElementById('edit-modal').classList.remove('hidden');
}
function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}
document.getElementById('edit-form').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    title: document.getElementById('edit-title').value,
    description: document.getElementById('edit-description').value,
    category: tagsToString(parseTags(document.getElementById('edit-category').value)),
    created_by: document.getElementById('edit-created_by').value,
    image_key: document.getElementById('edit-image_key').value || null,
  };
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  closeEditModal();
  await reloadAll();
  // 詳細モーダルが開いていれば中身を更新
  if (!document.getElementById('detail-modal').classList.contains('hidden')) {
    openDetailModal(id);
  }
});
document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.querySelector('#edit-modal .modal-backdrop').addEventListener('click', closeEditModal);

// ---------- 詳細モーダル ----------
function openDetailModal(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;
  renderDetailContent(card);
  document.getElementById('detail-modal').classList.remove('hidden');
}
function closeDetailModal() {
  document.getElementById('detail-modal').classList.add('hidden');
}
function renderDetailContent(card) {
  const tags = parseTags(card.category);
  const cardVisits = visitsCache.filter(v => v.card_id == card.id);
  const container = document.getElementById('detail-content');
  container.innerHTML = `
    <h2>${escapeHtml(card.title)}</h2>
    ${card.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(card.image_key)}" alt="">` : ''}
    <div>${escapeHtml(card.description || '')}</div>
    ${tags.length ? `<div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="card-meta">${card.created_by ? 'BY: ' + escapeHtml(card.created_by) : ''}</div>

    <div class="detail-note">
      <label>メモ</label>
      <textarea id="detail-note-input">${escapeHtml(card.note || '')}</textarea>
      <button id="detail-save-note">メモを保存</button>
    </div>

    <div class="detail-history">
      <h3>このカードの履歴 (${cardVisits.length})</h3>
      ${cardVisits.length === 0 ? '<div style="color:var(--muted);font-size:0.85rem;">まだ訪問履歴はありません</div>' : ''}
      ${cardVisits.map(v => `
        <div class="detail-history-item">
          <span class="date">${new Date(v.visited_at + 'Z').toLocaleString('ja-JP')}</span>
          <button class="ghost-btn detail-visit-delete" data-id="${v.id}" style="font-size:0.7rem;padding:0.2rem 0.5rem;">削除</button>
        </div>
      `).join('')}
    </div>

    <div class="row-actions" style="margin-top:1.2rem;">
      <button id="detail-edit-btn">編集</button>
      <button id="detail-delete-btn" class="danger-btn">カード削除</button>
    </div>
  `;
  // イベント
  document.getElementById('detail-save-note').addEventListener('click', async () => {
    const note = document.getElementById('detail-note-input').value;
    await fetch(`${API_CARDS}/${card.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: card.title,
        description: card.description,
        category: card.category,
        created_by: card.created_by,
        image_key: card.image_key,
        note,
      }),
    });
    await fetchCards();
    const updated = cardsCache.find(c => c.id == card.id);
    if (updated) renderDetailContent(updated);
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    closeDetailModal();
    openEditModal(card.id);
  });
  document.getElementById('detail-delete-btn').addEventListener('click', () => deleteCard(card.id));
  container.querySelectorAll('.detail-visit-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('この履歴を削除しますか?')) return;
      await fetch(`${API_VISITS}/${btn.dataset.id}`, { method: 'DELETE' });
      await fetchVisits();
      const updated = cardsCache.find(c => c.id == card.id);
      if (updated) renderDetailContent(updated);
      renderHistory();
    });
  });
}
document.getElementById('detail-close').addEventListener('click', closeDetailModal);
document.querySelector('#detail-modal .modal-backdrop').addEventListener('click', closeDetailModal);

// ---------- 履歴削除 ----------
async function deleteVisit(id) {
  if (!confirm('この履歴を削除しますか?')) return;
  await fetch(`${API_VISITS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- ピック ----------
function doPick() {
  const selectedTags = getSelectedTags();
  const andMode = document.getElementById('filter-mode-and').checked;
  const unvisitedOnly = document.getElementById('unvisited-only').checked;

  let candidates = cardsCache.slice();
  if (selectedTags.length > 0) {
    candidates = candidates.filter(c => {
      const cardTags = parseTags(c.category);
      return andMode
        ? selectedTags.every(t => cardTags.includes(t))
        : selectedTags.some(t => cardTags.includes(t));
    });
  }
  if (unvisitedOnly) {
    const visitedIds = new Set(visitsCache.map(v => v.card_id));
    candidates = candidates.filter(c => !visitedIds.has(c.id));
  }

  const area = document.getElementById('picked');
  const actions = document.getElementById('pick-actions');
  if (candidates.length === 0) {
    area.textContent = '該当するカードがありません';
    actions.classList.add('hidden');
    pendingPick = null;
    return;
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  pendingPick = picked;
  const tags = parseTags(picked.category);
  area.innerHTML = `
    <strong>${escapeHtml(picked.title)}</strong>
    ${picked.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(picked.image_key)}" alt="">` : ''}
    <div>${escapeHtml(picked.description || '')}</div>
    ${tags.length ? `<div class="tags" style="justify-content:center;">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
  `;
  actions.classList.remove('hidden');
}

document.getElementById('pick-btn').addEventListener('click', doPick);
document.getElementById('pick-reroll').addEventListener('click', doPick);

document.getElementById('pick-confirm').addEventListener('click', async () => {
  if (!pendingPick) return;
  await fetch(API_VISITS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: pendingPick.id }),
  });
  pendingPick = null;
  document.getElementById('pick-actions').classList.add('hidden');
  document.getElementById('picked').innerHTML = '<div style="color:var(--muted);font-size:0.9rem;">記録しました</div>';
  await fetchVisits();
  renderHistory();
});

document.getElementById('pick-cancel').addEventListener('click', () => {
  pendingPick = null;
  document.getElementById('picked').innerHTML = '';
  document.getElementById('pick-actions').classList.add('hidden');
});

// ---------- トグル ----------
document.querySelectorAll('.toggle-btn').forEach(btn =>
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.target).classList.toggle('hidden');
  })
);

// ---------- Esc キー ----------
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeEditModal();
    closeDetailModal();
  }
});

// ---------- 初期化 ----------
populateImageSelect('image_key');
populateImageSelect('edit-image_key');
document.getElementById('image_key').addEventListener('change', () => updateImagePreview('image_key', 'image-preview'));
document.getElementById('edit-image_key').addEventListener('change', () => updateImagePreview('edit-image_key', 'edit-image-preview'));
reloadAll();
