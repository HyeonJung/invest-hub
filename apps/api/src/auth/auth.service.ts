import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { SocialProvider, UserRole } from "@prisma/client";
import { encryptCredentialSecret } from "../common/credential-crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser, OAuthProfile, OAuthProvider, OAuthTokenResponse } from "./oauth.types";
import { KakaoStrategy } from "./strategies/kakao.strategy";
import { NaverStrategy } from "./strategies/naver.strategy";

type SessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const OAUTH_STATE_TTL_MS = 1000 * 60 * 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly kakaoStrategy: KakaoStrategy,
    private readonly naverStrategy: NaverStrategy
  ) {}

  async login(email: string, password: string, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { socialAccounts: true }
    });
    if (!user?.passwordHash || user.passwordHash !== password) {
      throw new UnauthorizedException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: { socialAccounts: true }
    });
    this.setSessionCookie(response, updated.id);
    return this.toAuthenticatedUser(updated);
  }

  startOAuth(provider: OAuthProvider, response: Response) {
    const state = randomBytes(24).toString("base64url");
    const redirectUri = this.getRedirectUri(provider);
    const strategy = this.getStrategy(provider);
    const authorizationUrl = strategy.buildAuthorizationUrl(state, redirectUri);
    response.cookie(this.stateCookieName(provider), state, {
      ...this.cookieOptions(),
      maxAge: OAUTH_STATE_TTL_MS
    });
    response.redirect(authorizationUrl);
  }

  async completeOAuth(
    provider: OAuthProvider,
    query: { code?: string; state?: string; error?: string; error_description?: string },
    request: Request,
    response: Response
  ) {
    try {
      if (query.error) {
        throw new UnauthorizedException(query.error_description ?? "사용자가 로그인을 취소했습니다.");
      }
      const code = query.code?.trim();
      const state = query.state?.trim();
      if (!code) throw new BadRequestException("OAuth authorization code가 없습니다.");
      if (!state) throw new BadRequestException("OAuth state가 없습니다.");
      this.assertValidState(provider, state, request);

      const redirectUri = this.getRedirectUri(provider);
      const token = await this.exchangeCode(provider, code, redirectUri, state);
      const profile = await this.getStrategy(provider).fetchProfile(token.accessToken);
      const user = await this.upsertOAuthUser(profile, token);
      response.clearCookie(this.stateCookieName(provider), this.cookieOptions());
      this.setSessionCookie(response, user.id);
      response.redirect(`${this.appUrl()}/dashboard`);
    } catch (error) {
      response.clearCookie(this.stateCookieName(provider), this.cookieOptions());
      response.redirect(`${this.appUrl()}/login?error=${encodeURIComponent(this.loginErrorCode(error))}`);
    }
  }

  async logout(response: Response) {
    response.clearCookie(this.sessionCookieName(), this.cookieOptions());
    return { ok: true };
  }

  async getCurrentUser(request: Request): Promise<AuthenticatedUser> {
    const token = this.readCookie(request, this.sessionCookieName());
    if (!token) throw new UnauthorizedException("로그인이 필요합니다.");
    const payload = this.verifySessionToken(token);
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { socialAccounts: true }
    });
    if (!user) throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    return this.toAuthenticatedUser(user);
  }

  async userIdFromRequest(request: Request) {
    const user = await this.getCurrentUser(request);
    return user.id;
  }

  async userIdFromToken(authHeader?: string) {
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedException("로그인이 필요합니다.");
    }

    const token = authHeader.replace("Bearer ", "");
    const payload = this.verifySessionToken(token);
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    return user.id;
  }

  private async exchangeCode(provider: OAuthProvider, code: string, redirectUri: string, state: string) {
    if (provider === "KAKAO") return this.kakaoStrategy.exchangeCode(code, redirectUri);
    return this.naverStrategy.exchangeCode(code, redirectUri, state);
  }

  private async upsertOAuthUser(profile: OAuthProfile, token: OAuthTokenResponse) {
    const now = new Date();
    const existingSocial = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId
        }
      },
      include: { user: true }
    });
    const tokenData = {
      providerEmail: profile.email,
      accessTokenEncrypted: encryptCredentialSecret(token.accessToken),
      refreshTokenEncrypted: token.refreshToken ? encryptCredentialSecret(token.refreshToken) : undefined,
      tokenExpiresAt: token.expiresIn ? new Date(now.getTime() + token.expiresIn * 1000) : undefined
    };

    if (existingSocial) {
      await this.prisma.socialAccount.update({
        where: { id: existingSocial.id },
        data: tokenData
      });
      return this.prisma.user.update({
        where: { id: existingSocial.userId },
        data: {
          email: profile.email,
          name: profile.name,
          profileImageUrl: profile.profileImageUrl ?? existingSocial.user.profileImageUrl,
          lastLoginAt: now
        },
        include: { socialAccounts: true }
      });
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: profile.email } });
    const user =
      existingUser ??
      (await this.prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          profileImageUrl: profile.profileImageUrl ?? null,
          lastLoginAt: now
        }
      }));

    await this.prisma.socialAccount.upsert({
      where: {
        userId_provider: {
          userId: user.id,
          provider: profile.provider
        }
      },
      create: {
        userId: user.id,
        provider: profile.provider,
        providerUserId: profile.providerUserId,
        ...tokenData
      },
      update: {
        providerUserId: profile.providerUserId,
        ...tokenData
      }
    });

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: profile.name,
        profileImageUrl: profile.profileImageUrl ?? user.profileImageUrl,
        lastLoginAt: now
      },
      include: { socialAccounts: true }
    });
  }

  private setSessionCookie(response: Response, userId: string) {
    response.cookie(this.sessionCookieName(), this.signSessionToken(userId), {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_SECONDS * 1000
    });
  }

  private signSessionToken(userId: string) {
    const now = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      sub: userId,
      iat: now,
      exp: now + SESSION_TTL_SECONDS
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = this.sign(body);
    return `${body}.${signature}`;
  }

  private verifySessionToken(token: string): SessionPayload {
    const [body, signature] = token.split(".");
    if (!body || !signature || !this.safeEqual(signature, this.sign(body))) {
      throw new UnauthorizedException("로그인 세션이 올바르지 않습니다.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("로그인 세션이 만료되었습니다.");
    }
    return payload;
  }

  private assertValidState(provider: OAuthProvider, state: string, request: Request) {
    const saved = this.readCookie(request, this.stateCookieName(provider));
    if (!saved || !this.safeEqual(saved, state)) {
      throw new UnauthorizedException("OAuth state 검증에 실패했습니다.");
    }
  }

  private sign(value: string) {
    return createHmac("sha256", this.sessionSecret()).update(value).digest("base64url");
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private getStrategy(provider: OAuthProvider) {
    return provider === "KAKAO" ? this.kakaoStrategy : this.naverStrategy;
  }

  private getRedirectUri(provider: OAuthProvider) {
    const envKey = provider === "KAKAO" ? "KAKAO_REDIRECT_URI" : "NAVER_REDIRECT_URI";
    return process.env[envKey]?.trim() ?? `${this.apiUrl()}/auth/${provider.toLowerCase()}/callback`;
  }

  private stateCookieName(provider: OAuthProvider) {
    return `invest_hub_oauth_${provider.toLowerCase()}_state`;
  }

  private sessionCookieName() {
    return process.env.AUTH_COOKIE_NAME?.trim() || "invest_hub_session";
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/"
    };
  }

  private shouldUseSecureCookies() {
    if (process.env.NODE_ENV !== "production") return false;
    return this.appUrl().startsWith("https://") || this.apiUrl().startsWith("https://");
  }

  private readCookie(request: Request, name: string) {
    const cookies = request.headers.cookie?.split(";") ?? [];
    for (const cookie of cookies) {
      const [rawKey, ...rawValue] = cookie.trim().split("=");
      if (rawKey === name) return decodeURIComponent(rawValue.join("="));
    }
    return null;
  }

  private sessionSecret() {
    const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("SESSION_SECRET 또는 JWT_SECRET이 설정되지 않았습니다.");
    }
    return secret ?? "invest-hub-local-session-secret";
  }

  private appUrl() {
    return process.env.APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  }

  private apiUrl() {
    return process.env.API_PUBLIC_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    name: string;
    profileImageUrl: string | null;
    role: UserRole;
    lastLoginAt: Date | null;
    socialAccounts: Array<{ provider: SocialProvider }>;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
      providers: user.socialAccounts.map((account) => account.provider as OAuthProvider)
    };
  }

  private loginErrorCode(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("이메일")) return "email_required";
    if (message.includes("state")) return "invalid_state";
    if (message.includes("Client")) return "oauth_config";
    if (message.includes("취소")) return "access_denied";
    return "oauth_failed";
  }
}
