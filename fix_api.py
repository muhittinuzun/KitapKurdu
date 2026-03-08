import json

filepath = '/Users/ahmetmuhittinuzun/Documents/eski belgeler/GitHub/KitapTakipApp/KitapKurdu/api_akisi.json'

with open(filepath, 'r') as f:
    workflow = json.load(f)

# Find the Smart SQL Builder node
for node in workflow['nodes']:
    if node['name'] == 'Smart SQL Builder':
        node['parameters']['jsCode'] = r"""// AKILLI SORGU OLUŞTURUCU (SQL BUILDER)
// Sözleşme: { action, resource, data, user_id }

const incoming = $json.body ?? $json;
const action = incoming.action;
let resource = incoming.resource || null;
const data = incoming.data || {};
const userId = incoming.user_id || null;

if (!action) {
  throw new Error('Eksik action alanı');
}

if (!resource) {
  if (action === 'get_groups' || action === 'resolve_code') {
    resource = 'k_t_groups';
  } else if (action === 'login' || action === 'register') {
    resource = 'k_t_users';
  } else if (action === 'log_read' || action === 'dashboard_stats' || action === 'leaderboard_group' || action === 'authority_stats' || action === 'authority_students' || action === 'get_user_books' || action === 'undo_read_log') {
    resource = 'k_t_read_logs';
  } else if (action === 'add_book_edition' || action === 'get_library_books') {
    resource = 'k_t_book_editions';
  } else if (action === 'sync_user_badges') {
    resource = 'k_t_user_badges';
  } else if (action === 'get_book_comments' || action === 'add_comment') {
    resource = 'k_t_book_comments';
  }
}

const allowedTables = ['k_t_groups', 'k_t_users', 'k_t_read_logs', 'k_t_badges', 'k_t_books', 'k_t_book_editions', 'k_t_user_badges', 'k_t_book_comments'];
if (!resource || !allowedTables.includes(resource)) {
  throw new Error(`Yetkisiz veya eksik tablo erişimi: ${resource || 'Belirtilmedi'}`);
}

let query = '';
let params = [];

if (action === 'get_groups') {
  query = `SELECT id, name FROM k_t_groups WHERE type = $1 AND (parent_id = $2 OR ($2 IS NULL AND parent_id IS NULL)) ORDER BY name ASC`;
  params = [data.type, data.parent_id || null];
}
else if (action === 'resolve_code') {
  query = `SELECT c.id as class_id, s.id as school_id, d.id as district_id, ci.id as city_id FROM k_t_groups c JOIN k_t_groups s ON c.parent_id = s.id JOIN k_t_groups d ON s.parent_id = d.id JOIN k_t_groups ci ON d.parent_id = ci.id WHERE c.join_code = $1 LIMIT 1`;
  params = [data.code ? String(data.code).trim().toUpperCase() : ''];
}
else if (action === 'login') {
  query = `SELECT id, full_name, email, group_id, LOWER(role) AS role FROM k_t_users WHERE LOWER(email) = LOWER($1) AND password_hash = $2 LIMIT 1`;
  params = [data.email, String(data.password || '')];
}
else if (action === 'register') {
  query = `WITH existing_user AS (SELECT id, full_name, email, group_id, LOWER(role) AS role FROM k_t_users WHERE LOWER(email) = LOWER($3) LIMIT 1), inserted_user AS (INSERT INTO k_t_users (group_id, full_name, email, password_hash, role) SELECT $1, $2, $3, $4, $5 WHERE NOT EXISTS (SELECT 1 FROM existing_user) RETURNING id, full_name, email, group_id, LOWER(role) AS role) SELECT id, full_name, email, group_id, role, false AS already_exists FROM inserted_user UNION ALL SELECT id, full_name, email, group_id, role, true AS already_exists FROM existing_user LIMIT 1`;
  params = [data.group_id || null, data.full_name, data.email, String(data.password || ''), String(data.role || 'student').toLowerCase()];
}
else if (action === 'add_book_edition') {
  query = `WITH existing_book AS (SELECT id FROM k_t_books WHERE LOWER(title) = LOWER($1) AND LOWER(COALESCE(author, '')) = LOWER(COALESCE($2, '')) LIMIT 1), inserted_book AS (INSERT INTO k_t_books (title, author, category) SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM existing_book) RETURNING id), book_pick AS (SELECT id FROM existing_book UNION ALL SELECT id FROM inserted_book LIMIT 1) INSERT INTO k_t_book_editions (isbn, book_id, page_count, thumbnail_url) VALUES ($4, (SELECT id FROM book_pick), $5, $6) ON CONFLICT (isbn) DO UPDATE SET book_id = EXCLUDED.book_id, page_count = EXCLUDED.page_count, thumbnail_url = EXCLUDED.thumbnail_url RETURNING isbn, book_id, page_count, thumbnail_url`;
  params = [data.title, data.author || null, data.category || null, data.isbn, Number(data.page_count), data.thumbnail_url || null];
}
else if (action === 'get_library_books') {
  // Anti Graviti Optimizasyonu (Performans + Sayfalama + Sıralama)
  const orderClause = data.order === 'popular' ? 'ORDER BY read_count DESC, b.id DESC' : 'ORDER BY b.id DESC';
  query = \`SELECT e.isbn, b.title, b.author, e.page_count, b.category, e.thumbnail_url, COUNT(DISTINCT r.user_id)::int as read_count FROM k_t_book_editions e JOIN k_t_books b ON e.book_id = b.id LEFT JOIN k_t_read_logs r ON e.isbn = r.book_isbn GROUP BY e.isbn, b.title, b.author, e.page_count, b.category, e.thumbnail_url \${orderClause} LIMIT $1 OFFSET $2\`;
  params = [Number(data.limit) || 100, Number(data.offset) || 0];
}
else if (action === 'get_user_books') {
  // Anti Graviti Optimizasyonu (Finished ve Dropped Bayrakları, 0 sayfalık başlangıç logları dahil)
  if (!userId) throw new Error('get_user_books için user_id zorunludur');
  query = \`SELECT e.isbn, b.title, b.author, e.page_count, e.thumbnail_url, b.category, COALESCE(SUM(r.pages_read), 0)::int as pages_read, MAX(r.read_date) as last_read_date, bool_or(r.note LIKE '[KT_EVENT]FINISH%') as finished, bool_or(r.note LIKE '[KT_EVENT]DROP%') as dropped FROM k_t_book_editions e JOIN k_t_books b ON e.book_id = b.id JOIN k_t_read_logs r ON e.isbn = r.book_isbn AND r.user_id = $1 GROUP BY e.isbn, b.title, b.author, e.page_count, e.thumbnail_url, b.category ORDER BY last_read_date DESC NULLS LAST\`;
  params = [userId];
}
else if (action === 'log_read') {
  if (!userId) throw new Error('log_read için user_id zorunludur');
  query = `INSERT INTO k_t_read_logs (user_id, book_isbn, pages_read, read_date, note) VALUES ($1, $2, $3, $4, $5) RETURNING id, user_id, book_isbn, pages_read, read_date, note`;
  params = [userId, data.book_isbn, Number(data.pages_read), data.read_date || null, data.note || null];
}
else if (action === 'undo_read_log') {
  if (!userId) throw new Error('undo_read_log için user_id zorunludur');
  if (!data.log_id) throw new Error('undo_read_log için log_id zorunludur');
  query = `DELETE FROM k_t_read_logs WHERE id = $1 AND user_id = $2 RETURNING id`;
  params = [data.log_id, userId];
}
else if (action === 'dashboard_stats') {
  if (!userId) throw new Error('dashboard_stats için user_id zorunludur');
  query = `WITH RECURSIVE base AS (SELECT book_isbn, pages_read, read_date::date AS read_date FROM k_t_read_logs WHERE user_id = $1), dates AS (SELECT DISTINCT read_date FROM base WHERE read_date IS NOT NULL), anchor AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM dates WHERE read_date = CURRENT_DATE) THEN CURRENT_DATE WHEN EXISTS (SELECT 1 FROM dates WHERE read_date = (CURRENT_DATE - INTERVAL '1 day')::date) THEN (CURRENT_DATE - INTERVAL '1 day')::date ELSE NULL END AS start_date), streak(d) AS (SELECT start_date FROM anchor WHERE start_date IS NOT NULL UNION ALL SELECT (streak.d - INTERVAL '1 day')::date FROM streak WHERE EXISTS (SELECT 1 FROM dates WHERE read_date = (streak.d - INTERVAL '1 day')::date)) SELECT COALESCE((SELECT COUNT(DISTINCT book_isbn) FROM base WHERE book_isbn IS NOT NULL), 0) AS read_books_count, COALESCE((SELECT SUM(pages_read) FROM base), 0) AS total_pages, COALESCE((SELECT COUNT(*) FROM streak), 0) AS streak_days`;
  params = [userId];
}
else if (action === 'leaderboard_group') {
  if (!data.group_id) throw new Error('leaderboard_group için group_id zorunludur');
  query = `SELECT u.id AS user_id, u.full_name, COALESCE(SUM(CASE WHEN r.note IS NULL OR r.note NOT LIKE '[KT_EVENT]%' THEN r.pages_read ELSE 0 END), 0) AS total_pages FROM k_t_users u LEFT JOIN k_t_read_logs r ON r.user_id = u.id WHERE u.group_id = $1 AND LOWER(COALESCE(u.role, 'student')) = 'student' GROUP BY u.id, u.full_name ORDER BY total_pages DESC, u.full_name ASC LIMIT $2`;
  params = [data.group_id, Number(data.limit) || 50];
}
else if (action === 'authority_stats') {
  query = `WITH monthly AS (SELECT TO_CHAR(DATE_TRUNC('month', read_date), 'YYYY-MM') AS month, SUM(pages_read)::int AS pages FROM k_t_read_logs WHERE read_date IS NOT NULL GROUP BY 1 ORDER BY 1 DESC LIMIT 6) SELECT COALESCE((SELECT SUM(pages_read) FROM k_t_read_logs), 0) AS total_pages, COALESCE((SELECT COUNT(*) FROM k_t_users WHERE LOWER(COALESCE(role, 'student')) = 'student'), 0) AS total_students, COALESCE((SELECT COUNT(DISTINCT user_id) FROM k_t_read_logs WHERE read_date >= (CURRENT_DATE - INTERVAL '30 day')), 0) AS active_students_30d, COALESCE((SELECT COUNT(DISTINCT book_isbn) FROM k_t_read_logs WHERE book_isbn IS NOT NULL), 0) AS distinct_books_started, COALESCE((SELECT JSON_AGG(ROW_TO_JSON(x)) FROM (SELECT month, pages FROM monthly ORDER BY month) x), '[]'::json) AS monthly`;
}
else if (action === 'authority_students') {
  query = `SELECT u.id AS user_id, u.full_name, u.email, COALESCE(SUM(r.pages_read), 0) AS total_pages, COUNT(DISTINCT r.book_isbn) FILTER (WHERE r.book_isbn IS NOT NULL) AS books_started FROM k_t_users u LEFT JOIN k_t_read_logs r ON r.user_id = u.id WHERE LOWER(COALESCE(u.role, 'student')) = 'student' GROUP BY u.id, u.full_name, u.email ORDER BY total_pages DESC, u.full_name ASC LIMIT $1`;
  params = [Number(data.limit) || 200];
}
else if (action === 'sync_user_badges') {
  if (!userId) throw new Error('sync_user_badges için user_id zorunludur');
  query = `WITH RECURSIVE base AS (SELECT book_isbn, pages_read, read_date::date AS read_date, note FROM k_t_read_logs WHERE user_id = $1), dates AS (SELECT DISTINCT read_date FROM base WHERE read_date IS NOT NULL), anchor AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM dates WHERE read_date = CURRENT_DATE) THEN CURRENT_DATE WHEN EXISTS (SELECT 1 FROM dates WHERE read_date = (CURRENT_DATE - INTERVAL '1 day')::date) THEN (CURRENT_DATE - INTERVAL '1 day')::date ELSE NULL END AS start_date), streak(d) AS (SELECT start_date FROM anchor WHERE start_date IS NOT NULL UNION ALL SELECT (streak.d - INTERVAL '1 day')::date FROM streak WHERE EXISTS (SELECT 1 FROM dates WHERE read_date = (streak.d - INTERVAL '1 day')::date)), metrics AS (SELECT COALESCE((SELECT SUM(pages_read) FROM base WHERE pages_read > 0), 0) AS total_pages, COALESCE((SELECT COUNT(DISTINCT book_isbn) FROM base WHERE note LIKE '[KT_EVENT]FINISH%'), 0) AS total_books, COALESCE((SELECT COUNT(*) FROM streak), 0) AS read_streak), eligible AS (SELECT b.id AS badge_id FROM k_t_badges b CROSS JOIN metrics m WHERE (b.requirement_type = 'total_pages' AND m.total_pages >= b.requirement_value) OR (b.requirement_type = 'total_books' AND m.total_books >= b.requirement_value) OR (b.requirement_type = 'read_streak' AND m.read_streak >= b.requirement_value)), inserted AS (INSERT INTO k_t_user_badges (user_id, badge_id, earned_at) SELECT $1, e.badge_id, NOW() FROM eligible e LEFT JOIN k_t_user_badges ub ON ub.user_id = $1 AND ub.badge_id = e.badge_id WHERE ub.badge_id IS NULL RETURNING badge_id) SELECT b.id, b.name, b.icon_key, b.requirement_type, b.requirement_value, CASE WHEN i.badge_id IS NOT NULL THEN true ELSE false END AS newly_earned FROM k_t_badges b JOIN k_t_user_badges ub ON ub.badge_id = b.id AND ub.user_id = $1 LEFT JOIN inserted i ON i.badge_id = b.id ORDER BY b.requirement_type ASC, b.requirement_value ASC`;
  params = [userId];
}
else if (action === 'get_book_comments') {
  // Bizim AI Güvenlik Duvarı Kontrolümüz (Sadece onaylıları getirir)
  query = `SELECT c.id, c.comment_text, c.created_at, u.full_name FROM k_t_book_comments c JOIN k_t_users u ON c.user_id = u.id WHERE c.book_isbn = $1 AND c.status = 'approved' ORDER BY c.created_at DESC`;
  params = [data.book_isbn];
}
else if (action === 'add_comment') {
  if (!userId) throw new Error('add_comment için user_id zorunludur');
  // Yeni eklenenleri direkt approved yapıyoruz (AI eklendiğinde pending yapacağız) ve created_at dönüyoruz.
  query = `INSERT INTO k_t_book_comments (book_isbn, user_id, comment_text, status) VALUES ($1, $2, $3, $4) RETURNING id, status, created_at`;
  params = [data.book_isbn, userId, data.comment_text, data.status || 'approved'];
}
else if (action === 'read') {
  const fields = Array.isArray(data.fields) && data.fields.length > 0 ? data.fields : ['*'];
  if (fields[0] !== '*') {
    const invalidField = fields.find((f) => !/^[a-zA-Z0-9_]+$/.test(f));
    if (invalidField) throw new Error(`Geçersiz field parametresi: ${invalidField}`);
  }

  const fieldSql = fields[0] === '*' ? '*' : fields.join(', ');
  query = `SELECT ${fieldSql} FROM ${resource}`;

  if (data.filters && typeof data.filters === 'object' && Object.keys(data.filters).length > 0) {
    const conditions = [];
    for (const [key, value] of Object.entries(data.filters)) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) throw new Error(`Geçersiz filter anahtarı: ${key}`);
      params.push(value);
      conditions.push(`${key} = $${params.length}`);
    }
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  if (data.order) {
    const orderValue = String(data.order).trim();
    if (!/^[a-zA-Z0-9_,.\s"]+$/.test(orderValue)) throw new Error('Geçersiz order parametresi');
    query += ` ORDER BY ${orderValue}`;
  }

  if (data.limit !== undefined && data.limit !== null) {
    const limitValue = Number(data.limit);
    if (!Number.isInteger(limitValue) || limitValue <= 0) throw new Error('Geçersiz limit parametresi');
    params.push(limitValue);
    query += ` LIMIT $${params.length}`;
  }

  if (data.offset !== undefined && data.offset !== null) {
    const offsetValue = Number(data.offset);
    if (!Number.isInteger(offsetValue) || offsetValue < 0) throw new Error('Geçersiz offset parametresi');
    params.push(offsetValue);
    query += ` OFFSET $${params.length}`;
  }
}
else {
  throw new Error(`Tanımsız action: ${action}`);
}

return { query, params, resource };"""
        break

# Write back with proper JSON formatting
with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print("Success - Smart SQL Builder updated with all fixes:")
print("  1. undo_read_log action + resource mapping added")
print("  2. get_book_comments JOIN cast fixed (removed ::varchar)")
print("  3. leaderboard_group event log filter added")
print("  4. add_book_edition thumbnail_url '' -> null")
print("  5. get_user_books b.category added to SELECT and GROUP BY")
