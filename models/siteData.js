'use strict';

const philosophyPoints = {
  vi: [
    {
      icon: 'filter_center_focus',
      title: 'Tập trung tối đa',
      desc: 'Giao diện tối giản loại bỏ mọi xao nhãng, giúp bạn chìm đắm hoàn toàn vào bài học.',
    },
    {
      icon: 'auto_awesome_motion',
      title: 'Nhịp độ tự nhiên',
      desc: 'Lộ trình học được thiết kế để tạo ra những khoảng nghỉ thông minh cho não bộ.',
    },
    {
      icon: 'flare',
      title: 'Sự minh triết',
      desc: 'Chuyển hóa dữ liệu ngôn ngữ thành kiến thức sâu sắc thông qua sự tĩnh lặng.',
    },
  ],
  ja: [
    {
      icon: 'filter_center_focus',
      title: '最大限の集中',
      desc: 'ミニマルなインターフェースがすべての散漫を取り除き、レッスンに完全に没頭できます。',
    },
    {
      icon: 'auto_awesome_motion',
      title: '自然なリズム',
      desc: '学習パスは脳のための賢い休憩を作り出すよう設計されています。',
    },
    {
      icon: 'flare',
      title: '明晰さ',
      desc: '静寂を通して言語データを深い知識へと変換します。',
    },
  ],
};

const aiFeatures = {
  vi: [
    {
      icon: 'psychology',
      title: 'AI Sensei 24/7',
      desc: 'Giải đáp mọi thắc mắc ngữ pháp ngay lập tức với sự tinh tế của người bản xứ.',
    },
    {
      icon: 'analytics',
      title: 'Phân tích chuyên sâu',
      desc: 'Theo dõi tiến trình học qua biểu đồ trực quan, nhận biết điểm yếu cần khắc phục.',
      offset: true,
    },
    {
      icon: 'graphic_eq',
      title: 'Luyện giọng chuẩn',
      desc: 'AI nhận diện giọng nói và chỉnh sửa phát âm chính xác từng âm tiết.',
    },
    {
      icon: 'history_edu',
      title: 'Gợi ý lộ trình',
      desc: 'Cá nhân hóa nội dung học dựa trên sở thích và tốc độ tiếp thu của bạn.',
      offset: true,
    },
  ],
  ja: [
    {
      icon: 'psychology',
      title: 'AI Sensei 24/7',
      desc: 'ネイティブスピーカーの繊細さで文法の疑問に即座に答えます。',
    },
    {
      icon: 'analytics',
      title: '詳細な分析',
      desc: 'ビジュアルチャートで学習の進捗を追跡し、改善すべき弱点を特定します。',
      offset: true,
    },
    {
      icon: 'graphic_eq',
      title: '発音練習',
      desc: 'AIが音声を認識し、各音節の発音を正確に修正します。',
    },
    {
      icon: 'history_edu',
      title: '学習パスの提案',
      desc: 'あなたの好みと習熟速度に基づいて学習コンテンツをパーソナライズします。',
      offset: true,
    },
  ],
};

const testimonials = {
  vi: [
    {
      text: 'Giao diện của Kizuna Nihongo thực sự giúp mình tĩnh tâm hơn khi học. AI Sensei giải thích ngữ pháp còn dễ hiểu hơn cả giáo viên thật.',
      name: 'Minh Anh',
      level: 'JLPT N2 Level',
    },
    {
      text: 'Khóa học Business Japanese rất thực tế. Mình đã tự tin hơn hẳn khi đi phỏng vấn tại các công ty IT Nhật Bản.',
      name: 'Hoàng Nam',
      level: 'Software Engineer',
    },
    {
      text: 'Sự kết hợp giữa Zen và AI là một bước đột phá. Không còn cảm giác bị áp lực bởi khối lượng kiến thức khổng lồ.',
      name: 'Thanh Hương',
      level: 'Du học sinh',
    },
  ],
  ja: [
    {
      text: 'Kizuna Nihongoのインターフェースは学習中に本当に心を落ち着かせてくれます。AI Senseiの文法説明は実際の先生より分かりやすいです。',
      name: 'Minh Anh',
      level: 'JLPT N2 レベル',
    },
    {
      text: 'ビジネス日本語コースはとても実践的です。日系IT企業の面接でずっと自信を持てるようになりました。',
      name: 'Hoàng Nam',
      level: 'ソフトウェアエンジニア',
    },
    {
      text: '禅とAIの組み合わせは画期的です。膨大な知識量に圧倒される感覚がなくなりました。',
      name: 'Thanh Hương',
      level: '留学生',
    },
  ],
};

function getData(lang) {
  const l = ['vi', 'ja'].includes(lang) ? lang : 'vi';
  return {
    philosophyPoints: philosophyPoints[l],
    aiFeatures:       aiFeatures[l],
    testimonials:     testimonials[l],
  };
}

module.exports = { getData };
