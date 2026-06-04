import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { OAuthProfile, OAuthTokenResponse } from "../oauth.types";

type NaverTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
};

type NaverProfilePayload = {
  resultcode?: string;
  message?: string;
  response?: {
    id?: string;
    email?: string;
    name?: string;
    nickname?: string;
    profile_image?: string;
  };
};

@Injectable()
export class NaverStrategy {
  readonly provider = "NAVER" as const;
  readonly authorizationEndpoint = "https://nid.naver.com/oauth2.0/authorize";
  private readonly tokenEndpoint = "https://nid.naver.com/oauth2.0/token";
  private readonly profileEndpoint = "https://openapi.naver.com/v1/nid/me";

  buildAuthorizationUrl(state: string, redirectUri: string) {
    const clientId = getRequiredEnv("NAVER_CLIENT_ID", "네이버 Client ID가 설정되지 않았습니다.");
    const url = new URL(this.authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string, state: string): Promise<OAuthTokenResponse> {
    const clientId = getRequiredEnv("NAVER_CLIENT_ID", "네이버 Client ID가 설정되지 않았습니다.");
    const clientSecret = getRequiredEnv("NAVER_CLIENT_SECRET", "네이버 Client Secret이 설정되지 않았습니다.");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
      redirect_uri: redirectUri
    });

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body
    });
    const payload = (await response.json().catch(() => ({}))) as NaverTokenPayload;
    if (!response.ok || !payload.access_token) {
      throw new UnauthorizedException(payload.error_description ?? "네이버 토큰 발급에 실패했습니다.");
    }

    const expiresIn = typeof payload.expires_in === "string" ? Number(payload.expires_in) : payload.expires_in;
    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined
    };
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(this.profileEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = (await response.json().catch(() => ({}))) as NaverProfilePayload;
    if (!response.ok || payload.resultcode !== "00") {
      throw new UnauthorizedException(payload.message ?? "네이버 사용자 정보 조회에 실패했습니다.");
    }

    const profile = payload.response;
    const providerUserId = profile?.id?.trim();
    const email = profile?.email?.trim();
    if (!providerUserId) throw new BadRequestException("네이버 사용자 식별값을 확인할 수 없습니다.");
    if (!email) throw new BadRequestException("네이버 계정에서 이메일 제공 동의가 필요합니다.");

    return {
      provider: this.provider,
      providerUserId,
      email,
      name: profile?.name ?? profile?.nickname ?? "네이버 사용자",
      profileImageUrl: profile?.profile_image ?? null
    };
  }
}

function getRequiredEnv(key: string, message: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new BadRequestException(message);
  return value;
}
