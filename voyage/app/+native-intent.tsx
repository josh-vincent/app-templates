type RedirectSystemPathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: RedirectSystemPathArgs) {
  const canvasPath = resolveCanvasPath(path);
  return canvasPath ?? path;
}

function resolveCanvasPath(path: string) {
  try {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(normalizedPath, 'screen-canvas://local');
    const routePath = url.pathname.replace(/^\/+/, '');
    if (routePath !== 'canvas') return undefined;

    const targetPath = url.searchParams.get('path');
    if (targetPath === '/') return '/(tabs)/(home)';
    if (targetPath?.startsWith('/')) return targetPath;
  } catch {
    return undefined;
  }

  return undefined;
}
