// DELETE /api/cards/:id : 削除
export async function onRequestDelete({ params, env }) {
  const { id } = params;
  await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
  return Response.json({ ok: true });
}

// PUT /api/cards/:id : 編集
export async function onRequestPut({ params, request, env }) {
  const { id } = params;
  const { title, description } = await request.json();
  if (!title) {
    return new Response('title is required', { status: 400 });
  }
  await env.DB.prepare(
    'UPDATE cards SET title = ?, description = ? WHERE id = ?'
  ).bind(title, description || '', id).run();
  return Response.json({ ok: true });
}
