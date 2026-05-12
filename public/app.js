const API = '/api/cards';

async function loadCards() {
  const res = await fetch(API);
  const cards = await res.json();
  const list = document.getElementById('card-list');
  list.innerHTML = '';
  cards.forEach(card => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${card.title}</strong><br>
      <span>${card.description || ''}</span><br>
      <button class="edit-btn" data-id="${card.id}">編集</button>
      <button class="delete-btn" data-id="${card.id}">削除</button>
    `;
    list.appendChild(li);
  });

  // 削除ボタン
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('本当に削除しますか？')) return;
      const id = btn.dataset.id;
      await fetch(`${API}/${id}`, { method: 'DELETE' });
      loadCards();
    });
  });

  // 編集ボタン
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const card = cards.find(c => c.id == id);
      const newTitle = prompt('新しいタイトル', card.title);
      if (newTitle === null) return; // キャンセル
      const newDesc = prompt('新しい説明', card.description || '');
      if (newDesc === null) return;
      await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, description: newDesc })
      });
      loadCards();
    });
  });
}

// 追加フォーム
document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description })
  });
  e.target.reset();
  loadCards();
});

// ランダムピック
document.getElementById('pick-btn').addEventListener('click', async () => {
  const res = await fetch(API);
  const cards = await res.json();
  if (cards.length === 0) {
    document.getElementById('picked').textContent = 'カードがありません';
    return;
  }
  const picked = cards[Math.floor(Math.random() * cards.length)];
  document.getElementById('picked').innerHTML =
    `🎯 <strong>${picked.title}</strong><br>${picked.description || ''}`;
});

loadCards();
