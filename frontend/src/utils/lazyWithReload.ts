import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RETRY_WINDOW_MS = 30_000;

const isDynamicImportFailure = (error: unknown) => {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /Failed to fetch dynamically imported module|Failed to load module script|Importing a module script failed|Loading chunk .* failed|MIME type/i.test(detail);
};

export const lazyWithReload = <T extends ComponentType<any>>(
  componentName: string,
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> => lazy(async () => {
  const retryKey = `chunk-reload:${componentName}`;

  try {
    const module = await importer();
    sessionStorage.removeItem(retryKey);
    return module;
  } catch (error) {
    const lastRetry = Number(sessionStorage.getItem(retryKey) || 0);
    const canRetry = !lastRetry || Date.now() - lastRetry > RETRY_WINDOW_MS;

    if (isDynamicImportFailure(error) && canRetry) {
      sessionStorage.setItem(retryKey, String(Date.now()));
      window.location.reload();
      return await new Promise<never>(() => undefined);
    }

    throw error;
  }
});
