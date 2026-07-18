import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

// Cho phép mỗi trang tự khai báo "đang hiển thị cái gì" để trợ lý AI biết ngữ cảnh.
// Route (đường dẫn) thì bubble tự lấy; phần này là dữ liệu cụ thể của trang.
const PageCtx = createContext({ page: null, setPage: () => {}, clearPage: () => {} });

export function PageContextProvider({ children }) {
  const [page, setPage] = useState(null);
  const clearPage = useCallback(() => setPage(null), []);
  return (
    <PageCtx.Provider value={{ page, setPage, clearPage }}>
      {children}
    </PageCtx.Provider>
  );
}

// Đọc ngữ cảnh trang hiện tại (bubble AI dùng).
export const useCurrentPage = () => useContext(PageCtx).page;

/**
 * Trang gọi hook này để khai báo ngữ cảnh cho AI. Tự dọn khi rời trang.
 *   usePageContext({ tab: 'Chi tiết khóa học', title: course?.title, data: {...} }, [course])
 * `data` nên gọn (id, tên, tiến độ…) — sẽ được nhét vào prompt.
 */
export function usePageContext(ctx, deps = []) {
  const { setPage, clearPage } = useContext(PageCtx);
  // Giữ ref để không cần setPage trong deps
  const setRef = useRef(setPage); setRef.current = setPage;
  const clearRef = useRef(clearPage); clearRef.current = clearPage;

  useEffect(() => {
    setRef.current(ctx || null);
    return () => clearRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default PageCtx;
