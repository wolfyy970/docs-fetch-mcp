import { RENDER_MODES } from '../config/tool-options.js';
import { FetchDocContentArgs, RenderMode } from '../types/index.js';

export function parseFetchDocContentArgs(input: unknown): FetchDocContentArgs {
  if (!isRecord(input)) {
    throw new Error('arguments must be an object');
  }

  if (typeof input.url !== 'string') {
    throw new Error('url is required');
  }

  const parsed: FetchDocContentArgs = {
    url: input.url,
  };

  assignOptionalNumber(parsed, input, 'depth');
  assignOptionalNumber(parsed, input, 'maxPages');
  assignOptionalNumber(parsed, input, 'maxConcurrency');
  assignOptionalNumber(parsed, input, 'timeoutMs');
  assignOptionalNumber(parsed, input, 'perPageTimeoutMs');
  assignOptionalNumber(parsed, input, 'contentLimit');
  assignOptionalBoolean(parsed, input, 'sameOrigin');
  assignOptionalBoolean(parsed, input, 'includeLinks');
  assignOptionalString(parsed, input, 'pathPrefix');

  if (input.render !== undefined) {
    if (typeof input.render !== 'string' || !isRenderMode(input.render)) {
      throw new Error('render must be one of: auto, always, never');
    }

    parsed.render = input.render;
  }

  return parsed;
}

function assignOptionalNumber<T extends keyof FetchDocContentArgs>(
  parsed: FetchDocContentArgs,
  input: Record<string, unknown>,
  key: T
): void {
  const value = input[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${String(key)} must be a finite number`);
  }

  Object.assign(parsed, { [key]: value });
}

function assignOptionalBoolean<T extends keyof FetchDocContentArgs>(
  parsed: FetchDocContentArgs,
  input: Record<string, unknown>,
  key: T
): void {
  const value = input[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${String(key)} must be a boolean`);
  }

  Object.assign(parsed, { [key]: value });
}

function assignOptionalString<T extends keyof FetchDocContentArgs>(
  parsed: FetchDocContentArgs,
  input: Record<string, unknown>,
  key: T
): void {
  const value = input[key];
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${String(key)} must be a string`);
  }

  Object.assign(parsed, { [key]: value });
}

function isRenderMode(value: string): value is RenderMode {
  return (RENDER_MODES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
