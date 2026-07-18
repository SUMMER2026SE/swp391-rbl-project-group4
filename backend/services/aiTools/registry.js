'use strict';

// Danh mục công cụ (whitelist) mà trợ lý AI được phép gọi.
//
// NGUYÊN TẮC BẢO MẬT:
// - Tool KHÔNG bao giờ đụng supabaseAdmin. Mọi tool được thực thi bằng cách gọi lại
//   chính endpoint HTTP kèm Bearer token của user → requireAuth + toàn bộ kiểm tra
//   sở hữu sẵn có tự áp dụng. Nhờ vậy AI chỉ thấy/sửa đúng dữ liệu của user đó.
// - kind:'write' luôn phải được người dùng bấm xác nhận trước khi chạy.
// - Không đưa vào đây: mọi thứ admin (đổi role, cấp premium), thanh toán/checkout,
//   mọi DELETE, publish, nộp bài thi/quiz/placement/mock, proctor telemetry.

const S = 'student';
const T = 'teacher';
const ALL = [S, T]; // admin luôn được coi là teacher+ (xem roleOf)

const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUuid = (v) => typeof v === 'string' && /^[0-9a-f-]{16,64}$/i.test(v);

const TOOLS = [
  // ── ĐỌC — dữ liệu của chính user ──────────────────────────────────────────
  {
    name: 'get_my_profile', kind: 'read', roles: ALL,
    desc: 'Hồ sơ của tôi: tên, trình độ hiện tại, mục tiêu JLPT, mục tiêu học.',
    method: 'GET', path: () => '/users/profile',
  },
  {
    name: 'get_my_dashboard', kind: 'read', roles: ALL,
    desc: 'Tổng quan học tập của tôi: streak, số từ/kanji/ngữ pháp đã học, giờ học, hoạt động gần đây.',
    method: 'GET', path: () => '/users/dashboard',
  },
  {
    name: 'get_my_learning_path', kind: 'read', roles: ALL,
    desc: 'Lộ trình học cá nhân hoá của tôi và tiến độ từng bước.',
    method: 'GET', path: () => '/learning-path',
  },
  {
    name: 'get_my_flashcard_sets', kind: 'read', roles: ALL,
    desc: 'Danh sách bộ thẻ ghi nhớ (flashcard) của tôi.',
    method: 'GET', path: () => '/flashcards/sets',
  },
  {
    name: 'get_my_subscription', kind: 'read', roles: ALL,
    desc: 'Gói đăng ký (free/premium) và hạn mức còn lại của tôi.',
    method: 'GET', path: () => '/subscription/me',
  },
  {
    name: 'get_my_purchases', kind: 'read', roles: ALL,
    desc: 'Các khoá học tôi đã mua.',
    method: 'GET', path: () => '/courses/my-purchases',
  },
  // ── ĐỌC — nội dung công khai ──────────────────────────────────────────────
  {
    name: 'list_courses', kind: 'read', roles: ALL,
    desc: 'Danh sách khoá học đang mở (có thể lọc theo cấp độ JLPT). args: { level? }',
    method: 'GET',
    path: (a) => `/courses?limit=10${a.level ? `&difficulty=${encodeURIComponent(str(a.level, 4))}` : ''}`,
  },
  {
    name: 'get_course', kind: 'read', roles: ALL,
    desc: 'Chi tiết một khoá học (bài học, tiến độ của tôi). args: { id }',
    method: 'GET', path: (a) => `/courses/${a.id}`,
    validate: (a) => (isUuid(a.id) ? null : 'id khoá học không hợp lệ.'),
  },
  {
    name: 'search_vocabulary', kind: 'read', roles: ALL,
    desc: 'Tra từ vựng trong hệ thống. args: { q, level? }',
    method: 'GET',
    path: (a) => `/vocabulary?search=${encodeURIComponent(str(a.q, 60))}&limit=10${a.level ? `&level=${encodeURIComponent(str(a.level, 4))}` : ''}`,
    validate: (a) => (str(a.q) ? null : 'Thiếu từ khoá tìm kiếm.'),
  },
  {
    name: 'search_kanji', kind: 'read', roles: ALL,
    desc: 'Tra kanji trong hệ thống. args: { q, level? }',
    method: 'GET',
    path: (a) => `/kanji?search=${encodeURIComponent(str(a.q, 60))}&limit=10${a.level ? `&level=${encodeURIComponent(str(a.level, 4))}` : ''}`,
    validate: (a) => (str(a.q) ? null : 'Thiếu từ khoá tìm kiếm.'),
  },
  // ── ĐỌC — giáo viên ───────────────────────────────────────────────────────
  {
    name: 'get_teacher_stats', kind: 'read', roles: [T],
    desc: 'Thống kê giảng dạy của tôi (khoá học, học viên...).',
    method: 'GET', path: () => '/teacher/stats',
  },
  {
    name: 'get_teacher_earnings', kind: 'read', roles: [T],
    desc: 'Thu nhập của tôi từ quỹ chia sẻ doanh thu.',
    method: 'GET', path: () => '/teacher/earnings',
  },
  {
    name: 'get_my_vocab', kind: 'read', roles: [T],
    desc: 'Các từ vựng do tôi tạo.',
    method: 'GET', path: () => '/teacher/my-vocab',
  },
  {
    name: 'get_my_kanji', kind: 'read', roles: [T],
    desc: 'Các kanji do tôi tạo.',
    method: 'GET', path: () => '/teacher/my-kanji',
  },

  // ── GHI — luôn cần xác nhận ───────────────────────────────────────────────
  {
    name: 'update_profile_goal', kind: 'write', roles: ALL,
    desc: 'Cập nhật mục tiêu JLPT / trình độ hiện tại / giới thiệu của tôi. args: { jlptTarget?, currentLevel?, bio? }',
    method: 'PUT', path: () => '/users/profile',
    validate: (a) => {
      const L = ['N5', 'N4', 'N3', 'N2', 'N1'];
      if (a.jlptTarget && !L.includes(a.jlptTarget)) return 'jlptTarget phải là N5–N1.';
      if (a.currentLevel && !L.includes(a.currentLevel)) return 'currentLevel phải là N5–N1.';
      if (!a.jlptTarget && !a.currentLevel && !str(a.bio)) return 'Không có gì để cập nhật.';
      return null;
    },
    // PUT /users/profile yêu cầu fullname → lấy hồ sơ hiện tại rồi trộn, tránh xoá mất tên.
    prepare: async (a, { call }) => {
      const cur = await call('GET', '/users/profile');
      const u = cur?.userData || cur?.user || {};
      return {
        fullname: u.full_name || u.fullname || '',
        phone: u.phone || undefined,
        ...(a.jlptTarget ? { jlptTarget: a.jlptTarget } : {}),
        ...(a.currentLevel ? { currentLevel: a.currentLevel } : {}),
        ...(str(a.bio) ? { bio: str(a.bio, 500) } : {}),
      };
    },
    summary: (a) => `Cập nhật hồ sơ: ${[
      a.jlptTarget && `mục tiêu ${a.jlptTarget}`,
      a.currentLevel && `trình độ hiện tại ${a.currentLevel}`,
      str(a.bio) && 'giới thiệu bản thân',
    ].filter(Boolean).join(', ')}`,
  },
  {
    name: 'create_flashcard_set', kind: 'write', roles: ALL,
    desc: 'Tạo bộ thẻ ghi nhớ mới. args: { title, description?, cards:[{term, definition}] } (cần ≥1 thẻ)',
    method: 'POST', path: () => '/flashcards/sets',
    validate: (a) => {
      if (!str(a.title)) return 'Thiếu tiêu đề bộ thẻ.';
      const cards = Array.isArray(a.cards) ? a.cards.filter(c => str(c?.term) && str(c?.definition)) : [];
      if (!cards.length) return 'Cần ít nhất 1 thẻ có đủ từ và nghĩa.';
      if (cards.length > 50) return 'Tối đa 50 thẻ mỗi lần.';
      return null;
    },
    body: (a) => ({
      title: str(a.title, 120),
      description: str(a.description, 300) || undefined,
      cards: a.cards.filter(c => str(c?.term) && str(c?.definition))
        .slice(0, 50).map(c => ({ term: str(c.term, 100), definition: str(c.definition, 300) })),
    }),
    summary: (a) => `Tạo bộ thẻ "${str(a.title, 60)}" với ${(a.cards || []).length} thẻ`,
  },
  {
    name: 'add_flashcard_card', kind: 'write', roles: ALL,
    desc: 'Thêm thẻ vào một bộ thẻ của tôi. args: { setId, term, definition }',
    method: 'POST', path: (a) => `/flashcards/sets/${a.setId}/cards`,
    validate: (a) => {
      if (!isUuid(a.setId)) return 'setId không hợp lệ.';
      if (!str(a.term) || !str(a.definition)) return 'Thẻ cần có đủ từ và nghĩa.';
      return null;
    },
    body: (a) => ({ term: str(a.term, 100), definition: str(a.definition, 300) }),
    summary: (a) => `Thêm thẻ "${str(a.term, 40)}" vào bộ thẻ`,
  },
  {
    name: 'create_flashcard_folder', kind: 'write', roles: ALL,
    desc: 'Tạo thư mục thẻ ghi nhớ. args: { name }',
    method: 'POST', path: () => '/flashcards/folders',
    validate: (a) => (str(a.name) ? null : 'Thiếu tên thư mục.'),
    body: (a) => ({ name: str(a.name, 80) }),
    summary: (a) => `Tạo thư mục "${str(a.name, 60)}"`,
  },
  {
    name: 'mark_learning_path_step', kind: 'write', roles: ALL,
    desc: 'Đánh dấu một bước trong lộ trình học là hoàn thành/chưa xong. args: { stepId, status: "completed"|"pending" }',
    method: 'PATCH', path: (a) => `/learning-path/steps/${a.stepId}`,
    validate: (a) => {
      if (!isUuid(a.stepId)) return 'stepId không hợp lệ.';
      if (!['completed', 'pending'].includes(a.status)) return 'status phải là completed hoặc pending.';
      return null;
    },
    body: (a) => ({ status: a.status }),
    summary: (a) => `Đánh dấu bước lộ trình là ${a.status === 'completed' ? 'đã hoàn thành' : 'chưa xong'}`,
  },
  {
    name: 'enroll_free_course', kind: 'write', roles: ALL,
    desc: 'Ghi danh vào một khoá học MIỄN PHÍ. args: { id }',
    method: 'POST', path: (a) => `/courses/${a.id}/enroll`,
    validate: (a) => (isUuid(a.id) ? null : 'id khoá học không hợp lệ.'),
    summary: () => 'Ghi danh vào khoá học miễn phí này',
  },
  // ── GHI — giáo viên ───────────────────────────────────────────────────────
  {
    name: 'create_my_vocab', kind: 'write', roles: [T],
    desc: 'Tạo từ vựng mới. args: { reading, meaning_vi, kanji?, meaning_ja?, level?, type?, example_sentence? }',
    method: 'POST', path: () => '/teacher/my-vocab',
    validate: (a) => (str(a.reading) && str(a.meaning_vi) ? null : 'Cần có cách đọc và nghĩa tiếng Việt.'),
    body: (a) => ({
      reading: str(a.reading, 100), meaning_vi: str(a.meaning_vi, 300),
      kanji: str(a.kanji, 50) || undefined, meaning_ja: str(a.meaning_ja, 300) || undefined,
      level: str(a.level, 4) || undefined, type: str(a.type, 40) || undefined,
      example_sentence: str(a.example_sentence, 300) || undefined,
    }),
    summary: (a) => `Tạo từ vựng "${str(a.kanji, 30) || str(a.reading, 30)}" — LƯU Ý: từ vựng vào kho DÙNG CHUNG (mọi người thấy được)`,
  },
  {
    name: 'create_my_kanji', kind: 'write', roles: [T],
    desc: 'Tạo kanji mới. args: { character, meaning_vi, reading_on?, reading_kun?, level?, stroke_count? }',
    method: 'POST', path: () => '/teacher/my-kanji',
    validate: (a) => (str(a.character) && str(a.meaning_vi) ? null : 'Cần có chữ kanji và nghĩa tiếng Việt.'),
    body: (a) => ({
      character: str(a.character, 8), meaning_vi: str(a.meaning_vi, 300),
      reading_on: a.reading_on, reading_kun: a.reading_kun,
      level: str(a.level, 4) || undefined,
      stroke_count: Number.isFinite(Number(a.stroke_count)) ? Number(a.stroke_count) : undefined,
    }),
    summary: (a) => `Tạo kanji "${str(a.character, 8)}" — LƯU Ý: kanji vào kho DÙNG CHUNG (mọi người thấy được)`,
  },
];

const BY_NAME = Object.fromEntries(TOOLS.map(t => [t.name, t]));

// admin coi như teacher (được cả tool của teacher); không có tool admin nào ở đây.
const roleOf = (user) => {
  const r = user?.user_metadata?.role;
  return r === 'admin' || r === 'teacher' ? T : S;
};

const toolsForRole = (role) => TOOLS.filter(t => t.roles.includes(role));

// Mô tả catalog để nhét vào prompt
const catalogText = (role) =>
  toolsForRole(role)
    .map(t => `- ${t.name} (${t.kind === 'write' ? 'GHI, cần xác nhận' : 'đọc'}): ${t.desc}`)
    .join('\n');

module.exports = { TOOLS, BY_NAME, roleOf, toolsForRole, catalogText };
