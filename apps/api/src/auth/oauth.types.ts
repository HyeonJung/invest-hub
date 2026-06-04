import type { SocialProvider } from "@prisma/client";

export type OAuthProvider = Extract<SocialProvider, "KAKAO" | "NAVER">;

export type OAuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  name: string;
  profileImageUrl?: string | null;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  profileImageUrl: string | null;
  lastLoginAt: Date | null;
  providers: OAuthProvider[];
};
