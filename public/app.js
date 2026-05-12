const API_CARDS = '/api/cards';
const API_VISITS = '/api/visits';

let cardsCache = [];
let visitsCache = [];

// ---------- 画像選択肢（追加フォームと編集モーダルで共通） ----------
const IMAGE_OPTIONS = [
  { value: '', label: '画像なし' },
  { value: 'cafe.png', label: 'カフェ' },
  { value: 'shopping.png', label: 'ショッピング' },
];


function populateImageSelect(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = IMAGE_OPTIONS.map(o =>
    `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`
  ).join('');
}

// ---------- 取得 ----------
async function fetchCards() {
  const res = await fetch(API_CARDS);
  cardsCache = await res.json();
}
async function fetchVisits() {
  const res = await fetch(API_VISITS);
  visitsCache = await res.json();
}

// ---------- 描画 ----------
function renderCards() {
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  cardsCache.forEach(card => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${escapeHtml(card.title)}</strong>
      ${card.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(card.image_key)}" alt="">` : ''}
      <div>${escapeHtml(card.description || '')}</div>
      <div class="card-meta">
        ${card.category ? 'CATEGORY: ' + escapeHtml(card.category) + ' / ' : ''}
        ${card.created_by ? 'BY: ' + escapeHtml(card.created_by) : ''}
      </div>
      <div class="row-actions">
        <button class="edit-btn" data-id="${card.id}">編集</button>
        <button class="delete-btn" data-id="${card.id}">削除</button>
      </div>
    `;
    list.appendChild(li);
  });

  list.querySelectorAll('.delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteCard(btn.dataset.id))
  );
  list.querySelectorAll('.edit-btn').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  );
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
      <strong>${escapeHtml(v.title || '（削除されたカード）')}</strong>
      <div class="card-meta">${date}</div>
      <div class="row-actions">
        <button class="visit-delete-btn" data-id="${v.id}">削除</button>
      </div>
    `;
    list.appendChild(li);
  });
  list.querySelectorAll('.visit-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteVisit(btn.dataset.id))
  );
}

function renderCategoryFilter() {
  const select = document.getElementById('filter-category');
  const current = select.value;
  const categories = [...new Set(cardsCache.map(c => c.category).filter(Boolean))];
  select.innerHTML = '<option value="">すべて</option>' +
    categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = current;
}

// ---------- リロード ----------
async function reloadAll() {
  await Promise.all([fetchCards(), fetchVisits()]);
  renderCards();
  renderHistory();
  renderCategoryFilter();
}

// ---------- カード追加 ----------
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('title').value,
    description: document.getElementById('description').value,
    category: document.getElementById('category').value,
    created_by: document.getElementById('created_by').value,
    image_key: document.getElementById('image_key').value || null,
  };
  await fetch(API_CARDS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  e.target.reset();
  reloadAll();
});

// ---------- カード削除 ----------
async function deleteCard(id) {
  if (!confirm('このカードを削除しますか？')) return;
  await fetch(`${API_CARDS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- カード編集（モーダル） ----------
function openEditModal(id) {
  const card = cardsCache.find(c => c.id == id);
  if (!card) return;

  document.getElementById('edit-id').value = card.id;
  document.getElementById('edit-title').value = card.title || '';
  document.getElementById('edit-description').value = card.description || '';
  document.getElementById('edit-category').value = card.category || '';
  document.getElementById('edit-created_by').value = card.created_by || '';
  document.getElementById('edit-image_key').value = card.image_key || '';

  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
  const payload = {
    title: document.getElementById('edit-title').value,
    description: document.getElementById('edit-description').value,
    category: document.getElementById('edit-category').value,
    created_by: document.getElementById('edit-created_by').value,
    image_key: document.getElementById('edit-image_key').value || null,
  };
  await fetch(`${API_CARDS}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  closeEditModal();
  reloadAll();
});

document.getElementById('edit-cancel').addEventListener('click', closeEditModal);
document.querySelector('#edit-modal .modal-backdrop').addEventListener('click', closeEditModal);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeEditModal();
});

// ---------- 履歴削除 ----------
async function deleteVisit(id) {
  if (!confirm('この履歴を削除しますか？')) return;
  await fetch(`${API_VISITS}/${id}`, { method: 'DELETE' });
  reloadAll();
}

// ---------- ピック ----------
document.getElementById('pick-btn').addEventListener('click', async () => {
  const filterCategory = document.getElementById('filter-category').value;
  const unvisitedOnly = document.getElementById('unvisited-only').checked;

  let candidates = cardsCache.slice();
  if (filterCategory) {
    candidates = candidates.filter(c => c.category === filterCategory);
  }
  if (unvisitedOnly) {
    const visitedIds = new Set(visitsCache.map(v => v.card_id));
    candidates = candidates.filter(c => !visitedIds.has(c.id));
  }

  const area = document.getElementById('picked');
  if (candidates.length === 0) {
    area.textContent = '該当するカードがありません';
    return;
  }
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  area.innerHTML = `
    <strong>${escapeHtml(picked.title)}</strong>
    ${picked.image_key ? `<img class="card-image" src="/images/${encodeURIComponent(picked.image_key)}" alt="">` : ''}
    <div>${escapeHtml(picked.description || '')}</div>
    <div class="meta">${picked.category ? escapeHtml(picked.category) : ''}</div>
  `;

  // 履歴に記録
  await fetch(API_VISITS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: picked.id }),
  });
  await fetchVisits();
  renderHistory();
});

// ---------- 表示/非表示トグル ----------
document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.target).classList.toggle('hidden');
  });
});

// ---------- ユーティリティ ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- 初期化 ----------
populateImageSelect('image_key');
populateImageSelect('edit-image_key');
reloadAll();
