export async function onRequestDelete({ params, env }) {
  const { id } = params;

  // 関連する履歴を先に削除
  await env.DB.prepare('DELETE FROM visits WHERE card_id = ?').bind(id).run();

  // それからカード本体を削除
  await env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();

  return Response.json({ ok: true });
}


export async function onRequestPut({ params, request, env }) {
  const { id } = params;
  const { title, description, category, created_by, image_key } = await request.json();
  if (!title) {
    return new Response('title is required', { status: 400 });
  }
  await env.DB.prepare(
    'UPDATE cards SET title = ?, description = ?, category = ?, created_by = ?, image_key = ? WHERE id = ?'
  ).bind(title, description || '', category || '', created_by || '', image_key || null, id).run();
  return Response.json({ ok: true });
}
