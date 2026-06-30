const TRACKING_PARAMS = [
  /^utm_/i,
  /^mc_/i,
  /^pk_/i,
  /^ga_/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^dclid$/i,
  /^igshid$/i,
  /^ref$/i,
  /^ref_src$/i,
];

export function normalizeUrl(rawUrl: string, baseUrl?: string): string | null {
  try {
    const parsed = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();

    if (
      (parsed.protocol === 'http:' && parsed.port === '80') ||
      (parsed.protocol === 'https:' && parsed.port === '443')
    ) {
      parsed.port = '';
    }

    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.some((pattern) => pattern.test(key))) {
        parsed.searchParams.delete(key);
      }
    }

    parsed.searchParams.sort();

    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function sameOrigin(leftUrl: string, rightUrl: string): boolean {
  try {
    const left = new URL(leftUrl);
    const right = new URL(rightUrl);
    return left.origin === right.origin;
  } catch {
    return false;
  }
}

export function isInPathPrefix(candidateUrl: string, rootUrl: string, pathPrefix?: string): boolean {
  if (!pathPrefix) {
    return true;
  }

  try {
    const candidate = new URL(candidateUrl);
    const root = new URL(rootUrl);
    const normalizedPrefix = pathPrefix.startsWith('/') ? pathPrefix : `/${pathPrefix}`;

    return candidate.origin === root.origin && candidate.pathname.startsWith(normalizedPrefix);
  } catch {
    return false;
  }
}

export function shouldSkipLink(href: string): boolean {
  const trimmed = href.trim().toLowerCase();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('data:')
  );
}
