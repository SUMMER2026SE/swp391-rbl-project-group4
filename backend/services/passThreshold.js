'use strict';

// Ngưỡng đạt của quiz/đề thi: 'percent' (% số câu đúng) | 'count' (số câu đúng) | null (không cấu hình).

// Trả về true/false nếu quiz có cấu hình ngưỡng, null nếu không cấu hình.
// Tính theo tổng số câu của chính lần làm bài (total), không theo tổng lúc đặt ngưỡng.
function computePassed(passingType, passingValue, score, total) {
  const val = Number(passingValue);
  if (passingType === 'percent') return total > 0 && (score / total) * 100 >= val;
  if (passingType === 'count')   return score >= val;
  return null;
}

// Mô tả ngưỡng cho thông báo người dùng (dùng trong message chặn hoàn thành).
function describeThreshold(passingType, passingValue) {
  if (passingType === 'percent') return `đạt tối thiểu ${passingValue}%`;
  if (passingType === 'count')   return `trả lời đúng ít nhất ${passingValue} câu`;
  return '';
}

// Chuẩn hoá & validate ngưỡng khi lưu.
// Trả về { error } nếu không hợp lệ, hoặc { type, value } đã chuẩn hoá (type/value = null nếu bỏ ngưỡng).
// totalQuestions: tổng số câu hiện có của quiz — chặn ngưỡng 'count' vượt quá.
function validateThreshold(passingType, passingValue, totalQuestions) {
  if (passingType == null || passingType === '') return { type: null, value: null };
  if (passingType !== 'percent' && passingType !== 'count')
    return { error: 'Loại ngưỡng đạt không hợp lệ.' };
  const val = Number(passingValue);
  if (!Number.isFinite(val) || val <= 0)
    return { error: 'Giá trị ngưỡng đạt phải là số dương.' };
  if (passingType === 'percent' && val > 100)
    return { error: 'Ngưỡng phần trăm không được vượt quá 100%.' };
  if (passingType === 'count' && val > totalQuestions)
    return { error: `Ngưỡng số câu (${val}) không được vượt quá tổng số câu hiện có (${totalQuestions}).` };
  return { type: passingType, value: val };
}

module.exports = { computePassed, describeThreshold, validateThreshold };
