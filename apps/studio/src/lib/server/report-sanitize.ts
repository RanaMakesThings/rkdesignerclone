import { extname, relative, resolve } from "node:path";

const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const IFRAME_TAG_RE = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
const INLINE_EVENT_HANDLER_RE = /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const ATTR_URL_RE = /\b(href|src)\s*=\s*("([^"]*)"|'([^']*)')/gi;
const SAFE_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const SCRIPT_SCHEME_RE = /^\s*javascript:/i;
const FILE_SCHEME_RE = /^\s*file:\/\//i;
const DENYLIST_SCHEME_RE = /^\s*(?:vbscript|data:text\/html)/i;

type RewriteContext = {
  repoRoot: string;
  reportAbsolutePath: string;
  isAllowedPath: (repoRelativePath: string) => boolean;
  projectId: string | null;
};

const isRepoContained = (repoRoot: string, absolutePath: string) => {
  const rel = relative(resolve(repoRoot), resolve(absolutePath));
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"));
};

const normalizeRepoRelative = (value: string) =>
  value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+/g, "/");

const toRepoRelative = (repoRoot: string, absolutePath: string) =>
  normalizeRepoRelative(relative(resolve(repoRoot), resolve(absolutePath)));

const isReportFile = (repoRelativePath: string) => {
  const ext = extname(repoRelativePath).toLowerCase();
  return ext === ".html";
};

const buildStudioRoute = ({
  repoRelativePath,
  projectId,
}: {
  repoRelativePath: string;
  projectId: string | null;
}) => {
  const route = isReportFile(repoRelativePath) ? "/api/report" : "/api/file";
  const search = new URLSearchParams({ path: repoRelativePath });
  if (projectId) {
    search.set("projectId", projectId);
  }
  return `${route}?${search.toString()}`;
};

const rewriteUrlAttribute = (
  _attrName: string,
  originalValue: string,
  context: RewriteContext
) => {
  const value = originalValue.trim();
  if (!value) {
    return value;
  }

  if (value.startsWith("#")) {
    return value;
  }

  if (FILE_SCHEME_RE.test(value)) {
    return "#";
  }

  if (SCRIPT_SCHEME_RE.test(value) || DENYLIST_SCHEME_RE.test(value)) {
    return "#";
  }

  if (SAFE_SCHEME_RE.test(value)) {
    return value;
  }

  const [pathPart, suffix = ""] = value.split(/([?#].*)/, 2);
  const decodedPathPart = (() => {
    try {
      return decodeURIComponent(pathPart);
    } catch {
      return pathPart;
    }
  })();

  const reportDir = resolve(context.reportAbsolutePath, "..");
  const candidateAbsolute = decodedPathPart.startsWith("/")
    ? resolve(context.repoRoot, `.${decodedPathPart}`)
    : resolve(reportDir, decodedPathPart);

  if (!isRepoContained(context.repoRoot, candidateAbsolute)) {
    return "#";
  }

  const candidateRepoRelative = toRepoRelative(context.repoRoot, candidateAbsolute);
  if (!context.isAllowedPath(candidateRepoRelative)) {
    return "#";
  }

  return `${buildStudioRoute({
    repoRelativePath: candidateRepoRelative,
    projectId: context.projectId,
  })}${suffix}`;
};

export const sanitizeReportHtml = (html: string, context: RewriteContext) => {
  let sanitized = html;

  sanitized = sanitized.replace(SCRIPT_TAG_RE, "");
  sanitized = sanitized.replace(IFRAME_TAG_RE, "");
  sanitized = sanitized.replace(INLINE_EVENT_HANDLER_RE, "");

  sanitized = sanitized.replace(
    ATTR_URL_RE,
    (_fullMatch, attrName: string, quotedValue: string, doubleQuoted: string, singleQuoted: string) => {
      const quote = quotedValue.startsWith('"') ? '"' : "'";
      const rawValue = doubleQuoted ?? singleQuoted ?? "";
      const rewritten = rewriteUrlAttribute(attrName.toLowerCase(), rawValue, context);
      return `${attrName}=${quote}${rewritten}${quote}`;
    }
  );

  return sanitized;
};
