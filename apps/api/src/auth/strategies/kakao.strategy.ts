import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { OAuthProfile, OAuthTokenResponse } from "../oauth.types";

type KakaoTokenPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type KakaoProfilePayload = {
  id?: number | string;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
};

@Injectable()
export class KakaoStrategy {
  readonly provider = "KAKAO" as const;
  readonly authorizationEndpoint = "https://kauth.kakao.com/oauth/authorize";
  private readonly tokenEndpoint = "https://kauth.kakao.com/oauth/token";
  private readonly profileEndpoint = "https://kapi.kakao.com/v2/user/me";

  buildAuthorizationUrl(state: string, redirectUri: string) {
    const clientId = getRequiredEnv("KAKAO_CLIENT_ID", "카카오 Client ID가 설정되지 않았습니다.");
    const url = new URL(this.authorizationEndpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", process.env.KAKAO_SCOPE?.trim() || "account_email");
    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const clientId = getRequiredEnv("KAKAO_CLIENT_ID", "카카오 Client ID가 설정되지 않았습니다.");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code
    });
    const clientSecret = process.env.KAKAO_CLIENT_SECRET;
    if (clientSecret) body.set("client_secret", clientSecret);

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body
    });
    const payload = (await response.json().catch(() => ({}))) as KakaoTokenPayload;
    if (!response.ok || !payload.access_token) {
      throw new UnauthorizedException(payload.error_description ?? "카카오 토큰 발급에 실패했습니다.");
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresIn: payload.expires_in
    };
  }

  async fetchProfile(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch(this.profileEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = (await response.json().catch(() => ({}))) as KakaoProfilePayload;
    if (!response.ok) {
      throw new UnauthorizedException("카카오 사용자 정보 조회에 실패했습니다.");
    }

    const providerUserId = payload.id ? String(payload.id) : "";
    const email = payload.kakao_account?.email?.trim();
    if (!providerUserId) throw new BadRequestException("카카오 사용자 식별값을 확인할 수 없습니다.");
    if (!email) throw new BadRequestException("카카오 계정에서 이메일 제공 동의가 필요합니다.");

    const profile = payload.kakao_account?.profile;
    return {
      provider: this.provider,
      providerUserId,
      email,
      name: profile?.nickname ?? payload.properties?.nickname ?? "카카오 사용자",
      profileImageUrl: profile?.profile_image_url ?? payload.properties?.profile_image ?? null
    };
  }
}

function getRequiredEnv(key: string, message: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new BadRequestException(message);
  return value;
}
