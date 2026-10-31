"use client";

import type { TimelineEvent } from "@/types";
import type { DismissMark, DismissStore } from "@/lib/dismiss";

/**
 * 跨设备偏好（点赞 / 不再推荐）前端模块 —— news 站。
 *
 * 部署时必须填（运维替换，不要把真实客户端 ID 提交进公开仓库之外的
 * 其他地方）：
 *   GOOGLE_CLIENT_ID —— 谷歌 Cloud Console 里该项目的 OAuth 客户端 ID，
 *   其「已获授权的 JavaScript 来源」必须包含 news.readcine.com、
 *   ai.readcine.com、deals.readcine.com。
 * 当前值是占位符；占位符状态下谷歌登录会失败，按钮会降级提示，
 * 不会谎称已同步。
 *
 * 后端约定（ECS 自建，部署时由运维提供，见 prefs API 说明）：
 *   POST /auth/google  { credential: <Google ID token> }
 *     -> 200 { sessionToken, email, expiresAt }，或 403（非允许账号）
 *   GET  /me            -> { email, blocked, liked }
 *   POST /sync         { blocked }              首次登录合并本地屏蔽
 *   POST /block        { id, mark }             POST /unblock { id }
 *   POST /like         { id, mark }             POST /unlike  { id }
 *   POST /clear        {}                       清空云端屏蔽（点赞不动）
 * 所有 /me 之后的接口都带 Authorization: Bearer <sessionToken>。
 * 账号范围：后端只允许 tonycter@gmail.com，403 时前端只提示、
 * 不执行屏蔽 / 点赞。
 */

// TODO(ops): 部署时替换为真实谷歌 OAuth 客户端 ID。
export const GOOGLE_CLIENT_ID = "GOOGLE_CLIENT_ID_PLACEHOLDER";
export const PREFS_API_BASE = "https://ai.readcine.com/api/prefs";
export const PREFS_SESSION_KEY = "readcine_prefs_session_v1";
export const PREFS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
export const ALLOWED_EMAIL = "tonycter@gmail.com";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";

export interface PrefsSession {
  token: string;
  email: string;
  expiresAt: number;
}

export interface LikeMark {
  at: number;
  type?: TimelineEvent["type"];
  filmId?: string;
  headline?: string;
  summary?: string;
}

export interface CloudPrefs {
  blocked: Record<string, DismissMark>;
  liked: Record<string, LikeMark>;
}

export class PrefsError extends Error {
  code: "not-logged-in" | "forbidden" | "api-unavailable" | "login-failed";
  constructor(code: PrefsError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export function isPlaceholderClientId(): boolean {
  return !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === "GOOGLE_CLIENT_ID_PLACEHOLDER";
}

export function loadPrefsSession(): PrefsSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFS_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PrefsSession;
    if (!parsed.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function savePrefsSession(session: PrefsSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_SESSION_KEY, JSON.stringify(session));
  } catch {
    // 忽略存储异常；下次仍需登录，不谎称已记住。
  }
}

export function clearPrefsSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFS_SESSION_KEY);
  } catch {
    // ignore
  }
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: (callback?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

let gsiLoading: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new PrefsError("login-failed", "不在浏览器环境"));
  }
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoading) return gsiLoading;
  gsiLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoading = null;
      reject(new PrefsError("login-failed", "谷歌登录脚本加载失败"));
    };
    document.head.appendChild(script);
  });
  return gsiLoading;
}

/** 弹谷歌登录，拿到 ID token 后换后端会话凭证；403 = 非允许账号。 */
export async function googleSignIn(): Promise<PrefsSession> {
  if (isPlaceholderClientId()) {
    throw new PrefsError(
      "login-failed",
      "谷歌登录尚未配置（客户端 ID 为占位符），请等运维部署时填入真实客户端 ID",
    );
  }
  await loadGsiScript();
  const googleId = window.google?.accounts?.id;
  if (!googleId) {
    throw new PrefsError("login-failed", "谷歌登录不可用");
  }
  const credential = await new Promise<string>((resolve, reject) => {
    try {
      googleId.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          if (response.credential) resolve(response.credential);
          else reject(new PrefsError("login-failed", "谷歌登录未完成"));
        },
      });
      googleId.prompt();
    } catch {
      reject(new PrefsError("login-failed", "谷歌登录弹框失败"));
    }
  });

  let res: Response;
  try {
    res = await fetch(`${PREFS_API_BASE}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
  } catch {
    throw new PrefsError("api-unavailable", "偏好服务不可用，暂未同步到云端");
  }
  if (res.status === 403) {
    throw new PrefsError("forbidden", `仅限 ${ALLOWED_EMAIL} 账号使用`);
  }
  if (!res.ok) {
    throw new PrefsError("api-unavailable", "偏好服务不可用，暂未同步到云端");
  }
  const data = (await res.json()) as {
    sessionToken?: string;
    email?: string;
    expiresAt?: number;
  };
  if (!data.sessionToken) {
    throw new PrefsError("login-failed", "登录凭证无效");
  }
  const session: PrefsSession = {
    token: data.sessionToken,
    email: data.email || "",
    expiresAt: data.expiresAt || Date.now() + PREFS_SESSION_TTL_MS,
  };
  savePrefsSession(session);
  return session;
}

/** 已有有效会话直接返回，否则弹谷歌登录。 */
export async function ensurePrefsSession(): Promise<PrefsSession> {
  const existing = loadPrefsSession();
  if (existing) return existing;
  return googleSignIn();
}

async function prefsFetch(
  session: PrefsSession,
  path: string,
  body?: unknown,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${PREFS_API_BASE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new PrefsError("api-unavailable", "偏好服务不可用，暂未同步到云端");
  }
  if (res.status === 401) {
    clearPrefsSession();
    throw new PrefsError("not-logged-in", "登录已过期，请重新登录");
  }
  if (res.status === 403) {
    throw new PrefsError("forbidden", `仅限 ${ALLOWED_EMAIL} 账号使用`);
  }
  if (!res.ok) {
    throw new PrefsError("api-unavailable", "偏好服务不可用，暂未同步到云端");
  }
  return res;
}

/** 从云端回填屏蔽 + 点赞；之后以云端为准。 */
export async function fetchCloudPrefs(session: PrefsSession): Promise<CloudPrefs> {
  const res = await prefsFetch(session, "/me");
  const data = (await res.json()) as Partial<CloudPrefs>;
  return {
    blocked:
      data.blocked && typeof data.blocked === "object" ? data.blocked : {},
    liked: data.liked && typeof data.liked === "object" ? data.liked : {},
  };
}

/** 首次登录：把本地屏蔽合并到云端。失败时抛错，调用方保留本地状态。 */
export async function syncLocalBlockedToCloud(
  session: PrefsSession,
  store: DismissStore,
): Promise<void> {
  await prefsFetch(session, "/sync", { blocked: store.blocked || {} });
}

export function dismissMarkFromEvent(event: TimelineEvent): DismissMark {
  return {
    at: Date.now(),
    type: event.type,
    filmId: event.filmId,
    headline: event.headline || event.filmTitle,
    summary: event.summary,
  };
}

export function likeMarkFromEvent(event: TimelineEvent): LikeMark {
  return {
    at: Date.now(),
    type: event.type,
    filmId: event.filmId,
    headline: event.headline || event.filmTitle,
    summary: event.summary,
  };
}

export async function cloudBlock(
  session: PrefsSession,
  event: TimelineEvent,
): Promise<void> {
  await prefsFetch(session, "/block", {
    id: event.id,
    mark: dismissMarkFromEvent(event),
  });
}

export async function cloudUnblock(
  session: PrefsSession,
  eventId: string,
): Promise<void> {
  await prefsFetch(session, "/unblock", { id: eventId });
}

export async function cloudLike(
  session: PrefsSession,
  event: TimelineEvent,
): Promise<void> {
  await prefsFetch(session, "/like", {
    id: event.id,
    mark: likeMarkFromEvent(event),
  });
}

export async function cloudUnlike(
  session: PrefsSession,
  eventId: string,
): Promise<void> {
  await prefsFetch(session, "/unlike", { id: eventId });
}

export async function cloudClearBlocked(session: PrefsSession): Promise<void> {
  await prefsFetch(session, "/clear", {});
}
