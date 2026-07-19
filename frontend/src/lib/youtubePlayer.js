// Helper dùng chung cho YouTube IFrame API (player nhúng + phát theo đoạn).

export const YT_ID_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/;

export function youtubeId(url) {
  return url?.match(YT_ID_RE)?.[1] || null;
}

// Nạp IFrame API 1 lần, trả về window.YT khi sẵn sàng.
let ytApiPromise = null;
export function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return ytApiPromise;
}
