// API helpers cho thi thử JLPT (student + admin). Bám axios instance chung.
import api from './api';

// ─── Student ──────────────────────────────────────────────────────────────────
export const listMockExams   = (level) => api.get('/mock-exams', { params: level ? { level } : {} }).then(r => r.data);
export const getMockExamMeta = (id)    => api.get(`/mock-exams/${id}`).then(r => r.data);
export const startMockAttempt = (id)   => api.post(`/mock-exams/${id}/attempts`).then(r => r.data);
export const getMockCurrent  = (aid)   => api.get(`/mock-exams/attempts/${aid}/current`).then(r => r.data);
export const saveMockAnswers = (aid, answers) => api.put(`/mock-exams/attempts/${aid}/answers`, { answers }).then(r => r.data);
export const submitMockSection = (aid, position, answers) =>
  api.post(`/mock-exams/attempts/${aid}/sections/${position}/submit`, { answers }).then(r => r.data);
export const getMockResult   = (aid)   => api.get(`/mock-exams/attempts/${aid}/result`).then(r => r.data);
export const getMockReview   = (aid)   => api.get(`/mock-exams/attempts/${aid}/review`).then(r => r.data);
export const getMockLeaderboard = (id) => api.get(`/mock-exams/${id}/leaderboard`).then(r => r.data);
export const getMockHistory  = ()      => api.get('/mock-exams/me/history').then(r => r.data);

// ─── Admin ────────────────────────────────────────────────────────────────────
export const adminListExams  = (params) => api.get('/admin/mock-exams', { params }).then(r => r.data);
export const adminCreateExam = (body)   => api.post('/admin/mock-exams', body).then(r => r.data);
export const adminGetExam    = (id)     => api.get(`/admin/mock-exams/${id}`).then(r => r.data);
export const adminUpdateExam = (id, body) => api.put(`/admin/mock-exams/${id}`, body).then(r => r.data);
export const adminPublishExam = (id, publish) => api.patch(`/admin/mock-exams/${id}/publish`, { publish }).then(r => r.data);
export const adminDeleteExam = (id)     => api.delete(`/admin/mock-exams/${id}`).then(r => r.data);
export const adminExamAttempts = (id, params) => api.get(`/admin/mock-exams/${id}/attempts`, { params }).then(r => r.data);

export const adminCreateSection = (examId, body) => api.post(`/admin/mock-exams/${examId}/sections`, body).then(r => r.data);
export const adminUpdateSection = (id, body) => api.put(`/admin/mock-sections/${id}`, body).then(r => r.data);
export const adminDeleteSection = (id)   => api.delete(`/admin/mock-sections/${id}`).then(r => r.data);
export const adminReorderSections = (ids) => api.patch('/admin/mock-sections/reorder', { ids }).then(r => r.data);

export const adminCreateGroup = (sectionId, body) => api.post(`/admin/mock-sections/${sectionId}/groups`, body).then(r => r.data);
export const adminUpdateGroup = (id, body) => api.put(`/admin/mock-groups/${id}`, body).then(r => r.data);
export const adminDeleteGroup = (id)   => api.delete(`/admin/mock-groups/${id}`).then(r => r.data);
export const adminReorderGroups = (ids) => api.patch('/admin/mock-groups/reorder', { ids }).then(r => r.data);

export const adminCreateQuestions = (groupId, questions) => api.post(`/admin/mock-groups/${groupId}/questions`, { questions }).then(r => r.data);
export const adminGenerateQuestionAudio = (id) => api.post(`/admin/mock-questions/${id}/tts`).then(r => r.data);
export const adminUpdateQuestion = (id, body) => api.put(`/admin/mock-questions/${id}`, body).then(r => r.data);
export const adminDeleteQuestion = (id) => api.delete(`/admin/mock-questions/${id}`).then(r => r.data);
export const adminReorderQuestions = (ids) => api.patch('/admin/mock-questions/reorder', { ids }).then(r => r.data);
export const adminImportFromBank = (groupId, question_ids) => api.post(`/admin/mock-groups/${groupId}/import-from-bank`, { question_ids }).then(r => r.data);
export const adminAiGenerate = (groupId, count, topic, instruction) => api.post(`/admin/mock-groups/${groupId}/ai-generate`, { count, topic, instruction }).then(r => r.data);
export const adminAiRegenerateOne = (groupId, body) => api.post(`/admin/mock-groups/${groupId}/ai-regenerate-one`, body).then(r => r.data);
// ─── Ngân hàng đề JLPT riêng (jlpt-bank) ──────────────────────────────────────
export const adminJlptBankStats           = (level)      => api.get('/admin/jlpt-bank/stats', { params: { level } }).then(r => r.data);
export const adminJlptBankListQuestions   = (params)     => api.get('/admin/jlpt-bank/questions', { params }).then(r => r.data);
export const adminJlptBankCreateQuestions = (body)       => api.post('/admin/jlpt-bank/questions', body).then(r => r.data);
export const adminJlptBankUpdateQuestion  = (id, body)   => api.put(`/admin/jlpt-bank/questions/${id}`, body).then(r => r.data);
export const adminJlptBankDeleteQuestion  = (id)         => api.delete(`/admin/jlpt-bank/questions/${id}`).then(r => r.data);
export const adminJlptBankQuestionTts     = (id)         => api.post(`/admin/jlpt-bank/questions/${id}/tts`).then(r => r.data);
export const adminJlptBankListGroups      = (params)     => api.get('/admin/jlpt-bank/groups', { params }).then(r => r.data);
export const adminJlptBankCreateGroup     = (body)       => api.post('/admin/jlpt-bank/groups', body).then(r => r.data);
export const adminJlptBankUpdateGroup     = (id, body)   => api.put(`/admin/jlpt-bank/groups/${id}`, body).then(r => r.data);
export const adminJlptBankDeleteGroup     = (id)         => api.delete(`/admin/jlpt-bank/groups/${id}`).then(r => r.data);
export const adminJlptBankAiGenerate      = (body)       => api.post('/admin/jlpt-bank/ai-generate', body).then(r => r.data);
export const adminJlptBankImportTemplate  = (level, mondai_type) =>
  api.get('/admin/jlpt-bank/import-template', { params: { level, mondai_type }, responseType: 'blob' }).then(r => r.data);
export const adminJlptBankImportCommit    = (body)       => api.post('/admin/jlpt-bank/import-commit', body).then(r => r.data);
export function adminJlptBankImportFile(level, mondai_type, file) {
  const form = new FormData();
  form.append('level', level);
  form.append('mondai_type', mondai_type);
  form.append('file', file);
  return api.post('/admin/jlpt-bank/import-file', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
}

export function adminUploadMedia(kind, file) {
  const form = new FormData();
  form.append(kind === 'audio' ? 'audio' : 'image', file);
  const url = kind === 'audio' ? '/admin/mock-exams/upload-audio' : '/admin/mock-exams/upload-image';
  return api.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
}
