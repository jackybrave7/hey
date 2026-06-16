/** Прокрутка основной страницы вкладки в самый верх (тап по заголовку). */
export function scrollPageToTop(behavior = 'smooth') {
  try {
    window.scrollTo({ top: 0, left: 0, behavior });
  } catch {
    window.scrollTo(0, 0);
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}
