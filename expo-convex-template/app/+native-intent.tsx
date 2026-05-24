// Deep-link routing.
//
// expo-router calls redirectSystemPath whenever the OS hands us a URL to
// open. We use it for two productive flows:
//
//   fitstake://join/<username>  → /join/<username>  (referral landing)
//   fitstake://bet/<id>          → /(tabs)/challenges/<id>  (h2h invite)
//
// Plus we keep the existing screen-canvas tooling path. Anything we don't
// recognise falls through to the default router.

type RedirectSystemPathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: RedirectSystemPathArgs) {
  const canvasPath = resolveCanvasPath(path);
  if (canvasPath) return canvasPath;

  const fitstakePath = resolveFitstakePath(path);
  if (fitstakePath) return fitstakePath;

  return path;
}

function resolveFitstakePath(path: string): string | undefined {
  try {
    // fitstake://join/<username> arrives as either 'fitstake://join/josh'
    // or a stripped '/join/josh' depending on the source. Handle both.
    const stripped = path
      .replace(/^[a-z]+:\/\//i, '')
      .replace(/^\/+/, '');

    // join/<username>
    const joinMatch = stripped.match(/^join\/?([^/?#]*)(?:[/?#].*)?$/i);
    if (joinMatch) {
      const ref = joinMatch[1] ?? '';
      return ref ? `/join/${encodeURIComponent(ref.toLowerCase())}` : '/join';
    }

    // bet/<id>
    const betMatch = stripped.match(/^bet\/?([^/?#]+)(?:[/?#].*)?$/i);
    if (betMatch) {
      return `/(tabs)/challenges/${encodeURIComponent(betMatch[1])}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
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
