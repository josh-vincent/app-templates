// Deep-link routing for Voyager.
//
// Recognised:
//   voyager://trip/<id>  → /trip/<id>
//   plus the screen-canvas tooling path used by the dev harness.

type RedirectSystemPathArgs = {
  path: string;
  initial: boolean;
};

export function redirectSystemPath({ path }: RedirectSystemPathArgs) {
  const canvasPath = resolveCanvasPath(path);
  if (canvasPath) return canvasPath;

  const voyagerPath = resolveVoyagerPath(path);
  if (voyagerPath) return voyagerPath;

  return path;
}

function resolveVoyagerPath(path: string): string | undefined {
  try {
    const stripped = path
      .replace(/^[a-z]+:\/\//i, '')
      .replace(/^\/+/, '');

    const tripMatch = stripped.match(/^trip\/?([^/?#]+)(?:[/?#].*)?$/i);
    if (tripMatch) {
      return `/trip/${encodeURIComponent(tripMatch[1])}`;
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
