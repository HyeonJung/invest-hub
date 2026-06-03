import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { decryptCredentialSecret, encryptCredentialSecret, previewCredentialSecret } from "../common/credential-crypto";

type TossAccountInput = {
  accountAlias?: string;
  accountType?: "BROKERAGE" | "PENSION_SAVINGS" | "ISA" | "MANUAL";
  externalAccountId?: string;
};

type KiwoomCredentialInput = {
  connectionId?: string;
  label?: string;
  appKey: string;
  secretKey?: string;
  useMock?: boolean;
};

type NamuhCredentialInput = {
  connectionId?: string;
  label?: string;
  loginId: string;
  loginPassword?: string;
  certificatePassword?: string;
  accountPassword?: string;
  certificateMode?: "PC" | "CLOUD";
  environment?: "REAL" | "MOCK";
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  listTargets(userId: string) {
    return this.prisma.portfolioTarget.findMany({
      where: { userId },
      orderBy: [{ targetType: "asc" }, { targetKey: "asc" }]
    });
  }

  async saveTargets(userId: string, targets: Array<{ targetType: string; targetKey: string; targetWeight: number }>) {
    await this.prisma.$transaction(
      targets.map((target) =>
        this.prisma.portfolioTarget.upsert({
          where: {
            userId_targetType_targetKey: {
              userId,
              targetType: target.targetType,
              targetKey: target.targetKey
            }
          },
          create: {
            userId,
            targetType: target.targetType,
            targetKey: target.targetKey,
            targetWeight: target.targetWeight
          },
          update: {
            targetWeight: target.targetWeight
          }
        })
      )
    );

    return this.listTargets(userId);
  }

  async listTossCredentials(userId: string) {
    const accounts = await this.prisma.investmentAccount.findMany({
      where: { userId, broker: "TOSS" },
      include: { apiCredential: true },
      orderBy: { createdAt: "asc" }
    });

    return accounts.map((account) => ({
      accountId: account.id,
      accountAlias: account.accountAlias,
      accountType: account.accountType,
      externalAccountId: account.externalAccountId,
      currencyBase: account.currencyBase,
      credential: account.apiCredential
        ? {
            clientId: account.apiCredential.clientId,
            secretPreview: account.apiCredential.secretPreview,
            status: account.apiCredential.status,
            lastValidatedAt: account.apiCredential.lastValidatedAt,
            lastUsedAt: account.apiCredential.lastUsedAt,
            updatedAt: account.apiCredential.updatedAt
          }
        : null
    }));
  }

  async createTossAccount(userId: string, body: TossAccountInput) {
    const accountCount = await this.prisma.investmentAccount.count({ where: { userId, broker: "TOSS" } });
    await this.ensureTossConnection(userId);

    await this.prisma.investmentAccount.create({
      data: {
        userId,
        broker: "TOSS",
        accountAlias: body.accountAlias?.trim() || `토스증권 ${accountCount + 1}`,
        accountType: body.accountType ?? "BROKERAGE",
        externalAccountId: body.externalAccountId?.trim() || null,
        currencyBase: "KRW"
      }
    });

    return this.listTossCredentials(userId);
  }

  async saveTossCredential(userId: string, body: { accountId: string; clientId: string; clientSecret?: string }) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: { id: body.accountId, userId, broker: "TOSS" },
      include: { apiCredential: true }
    });
    if (!account) {
      throw new BadRequestException("토스증권 계좌를 찾을 수 없습니다.");
    }

    const clientId = body.clientId?.trim();
    const clientSecret = body.clientSecret?.trim();
    if (!clientId) {
      throw new BadRequestException("토스증권 client_id를 입력하세요.");
    }
    if (!account.apiCredential && !clientSecret) {
      throw new BadRequestException("처음 저장할 때는 client_secret이 필요합니다.");
    }

    if (account.apiCredential) {
      await this.prisma.accountApiCredential.update({
        where: { accountId: account.id },
        data: {
          clientId,
          ...(clientSecret
            ? {
                encryptedSecret: encryptCredentialSecret(clientSecret),
                secretPreview: previewCredentialSecret(clientSecret)
              }
            : {}),
          status: "ACTIVE",
          metadata: {
            provider: "toss-open-api",
            storage: "account"
          }
        }
      });
    } else {
      await this.prisma.accountApiCredential.create({
        data: {
          userId,
          accountId: account.id,
          broker: "TOSS",
          clientId,
          encryptedSecret: encryptCredentialSecret(clientSecret ?? ""),
          secretPreview: previewCredentialSecret(clientSecret ?? ""),
          status: "ACTIVE",
          metadata: {
            provider: "toss-open-api",
            storage: "account"
          }
        }
      });
    }

    await this.ensureTossConnection(userId);
    return this.listTossCredentials(userId);
  }

  async deleteTossCredential(userId: string, accountId: string) {
    const account = await this.prisma.investmentAccount.findFirst({
      where: { id: accountId, userId, broker: "TOSS" },
      include: { apiCredential: true }
    });
    if (!account) {
      throw new BadRequestException("토스증권 계좌를 찾을 수 없습니다.");
    }
    if (account.apiCredential) {
      await this.prisma.accountApiCredential.delete({ where: { accountId } });
    }
    return this.listTossCredentials(userId);
  }

  async getKiwoomCredential(userId: string) {
    const firstProfile = (await this.listKiwoomCredentials(userId))[0];
    if (firstProfile) {
      return {
        appKey: firstProfile.appKey,
        secretPreview: firstProfile.secretPreview,
        status: firstProfile.status,
        useMock: firstProfile.useMock,
        baseUrl: firstProfile.baseUrl,
        source: firstProfile.source,
        updatedAt: firstProfile.updatedAt
      };
    }

    const envAppKey = process.env.KIWOOM_APP_KEY?.trim();
    const envSecretKey = process.env.KIWOOM_SECRET_KEY?.trim();
    if (envAppKey && envSecretKey) {
      const useMock = process.env.KIWOOM_USE_MOCK_API === "true";
      return {
        appKey: envAppKey,
        secretPreview: previewCredentialSecret(envSecretKey),
        status: "ACTIVE",
        useMock,
        baseUrl: kiwoomBaseUrl(useMock),
        source: "ENV",
        updatedAt: null
      };
    }

    return emptyKiwoomCredential();
  }

  async listKiwoomCredentials(userId: string) {
    const [connections, accounts] = await Promise.all([
      this.prisma.brokerConnection.findMany({
        where: { userId, broker: "KIWOOM" },
        include: { credential: true },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.investmentAccount.findMany({
        where: { userId, broker: "KIWOOM", apiCredential: { isNot: null } },
        include: { apiCredential: true },
        orderBy: { createdAt: "asc" }
      })
    ]);

    return connections
      .filter((connection) => {
        const metadata = readMetadata(connection.credential?.metadata);
        return Boolean(connection.credential?.clientId) && Boolean(connection.credential?.encryptedSecret) && metadata.credentialType === "kiwoom-app";
      })
      .map((connection, index) => {
        const metadata = readMetadata(connection.credential?.metadata);
        const useMock = Boolean(metadata.useMock);
        return {
          connectionId: connection.id,
          label: metadata.label ?? `키움 키 ${index + 1}`,
          appKey: connection.credential?.clientId ?? null,
          appKeyPreview: previewCredentialSecret(connection.credential?.clientId ?? ""),
          secretPreview: metadata.secretPreview ?? null,
          status: connection.status,
          useMock,
          baseUrl: metadata.baseUrl ?? kiwoomBaseUrl(useMock),
          source: "DB",
          updatedAt: metadata.updatedAt ?? null,
          accounts: accounts
            .filter((account) => readMetadata(account.apiCredential?.metadata).connectionId === connection.id)
            .map((account) => ({
              accountId: account.id,
              accountAlias: account.accountAlias,
              brokerAccountNo: account.brokerAccountNo,
              externalAccountId: account.externalAccountId,
              credentialStatus: account.apiCredential?.status ?? "INACTIVE",
              lastUsedAt: account.apiCredential?.lastUsedAt ?? null,
              updatedAt: account.apiCredential?.updatedAt ?? null
            }))
        };
      });
  }

  async saveKiwoomCredential(userId: string, body: KiwoomCredentialInput) {
    await this.saveKiwoomCredentialProfile(userId, body);
    return this.getKiwoomCredential(userId);
  }

  async saveKiwoomCredentialProfile(userId: string, body: KiwoomCredentialInput) {
    const appKey = body.appKey?.trim();
    const secretKey = body.secretKey?.trim();
    if (!appKey) {
      throw new BadRequestException("키움 App Key를 입력하세요.");
    }

    const existing = body.connectionId
      ? await this.prisma.brokerConnection.findFirst({
          where: { id: body.connectionId, userId, broker: "KIWOOM" },
          include: { credential: true }
        })
      : null;
    if (body.connectionId && !existing) {
      throw new BadRequestException("수정할 키움 API 키를 찾을 수 없습니다.");
    }

    const existingMetadata = readMetadata(existing?.credential?.metadata);
    const canKeepSecret = Boolean(existing?.credential?.encryptedSecret) && existingMetadata.credentialType === "kiwoom-app";
    if (!secretKey && !canKeepSecret) {
      throw new BadRequestException("처음 저장할 때는 키움 Secret Key가 필요합니다.");
    }

    const useMock = Boolean(body.useMock);
    const profileCount = await this.prisma.brokerConnection.count({ where: { userId, broker: "KIWOOM" } });
    const label = body.label?.trim() || existingMetadata.label || `키움 키 ${profileCount + 1}`;
    const connection = existing
      ? await this.prisma.brokerConnection.update({
          where: { id: existing.id },
          data: {
            brokerType: "KIWOOM",
            connectionType: "API",
            status: existing.status ?? "INACTIVE"
          }
        })
      : await this.prisma.brokerConnection.create({
          data: {
            userId,
            broker: "KIWOOM",
            brokerType: "KIWOOM",
            connectionType: "API",
            status: "INACTIVE"
          }
        });

    await this.prisma.brokerCredential.upsert({
      where: { connectionId: connection.id },
      create: {
        connectionId: connection.id,
        clientId: appKey,
        encryptedSecret: encryptCredentialSecret(secretKey ?? ""),
        metadata: kiwoomCredentialMetadata(useMock, secretKey ? previewCredentialSecret(secretKey) : null, label)
      },
      update: {
        clientId: appKey,
        ...(secretKey
          ? {
              encryptedSecret: encryptCredentialSecret(secretKey)
            }
          : {}),
        metadata: kiwoomCredentialMetadata(
          useMock,
          secretKey ? previewCredentialSecret(secretKey) : existingMetadata.secretPreview ?? null,
          label
        )
      }
    });

    return this.listKiwoomCredentials(userId);
  }

  async deleteKiwoomCredential(userId: string) {
    const firstProfile = (await this.listKiwoomCredentials(userId))[0];
    if (!firstProfile) return emptyKiwoomCredential();
    await this.deleteKiwoomCredentialProfile(userId, firstProfile.connectionId);
    return this.getKiwoomCredential(userId);
  }

  async deleteKiwoomCredentialProfile(userId: string, connectionId: string) {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { id: connectionId, userId, broker: "KIWOOM" }
    });
    if (!connection) {
      throw new BadRequestException("삭제할 키움 API 키를 찾을 수 없습니다.");
    }

    const accountCredentials = await this.prisma.accountApiCredential.findMany({
      where: { userId, broker: "KIWOOM" }
    });
    const linkedAccountIds = accountCredentials
      .filter((credential) => readMetadata(credential.metadata).connectionId === connectionId)
      .map((credential) => credential.accountId);

    if (linkedAccountIds.length > 0) {
      await this.prisma.accountApiCredential.deleteMany({ where: { accountId: { in: linkedAccountIds } } });
    }

    await this.prisma.brokerConnection.delete({ where: { id: connection.id } });
    return this.listKiwoomCredentials(userId);
  }

  async listNamuhCredentials(userId: string) {
    const [connections, accounts] = await Promise.all([
      this.prisma.brokerConnection.findMany({
        where: { userId, broker: "NAMUH" },
        include: { credential: true },
        orderBy: { createdAt: "asc" }
      }),
      this.prisma.investmentAccount.findMany({
        where: { userId, broker: "NAMUH", apiCredential: { isNot: null } },
        include: { apiCredential: true },
        orderBy: { createdAt: "asc" }
      })
    ]);

    return connections
      .filter((connection) => {
        const metadata = readMetadata(connection.credential?.metadata);
        return metadata.provider === "namuh-wmca-openapi" && metadata.credentialType === "namuh-wmca-login";
      })
      .map((connection, index) => {
        const metadata = readMetadata(connection.credential?.metadata);
        return {
          connectionId: connection.id,
          label: metadata.label ?? `나무 계정 ${index + 1}`,
          loginId: connection.credential?.clientId ?? null,
          loginIdPreview: previewCredentialSecret(connection.credential?.clientId ?? ""),
          passwordPreview: metadata.passwordPreview ?? null,
          certificatePasswordPreview: metadata.certificatePasswordPreview ?? null,
          accountPasswordPreview: metadata.accountPasswordPreview ?? null,
          status: connection.status,
          environment: metadata.environment ?? "REAL",
          certificateMode: metadata.certificateMode ?? "PC",
          bridgeUrl: process.env.NAMUH_WMCA_BRIDGE_URL ?? null,
          source: "DB",
          updatedAt: metadata.updatedAt ?? null,
          errorMessage: metadata.errorMessage ?? null,
          accounts: accounts
            .filter((account) => readMetadata(account.apiCredential?.metadata).connectionId === connection.id)
            .map((account) => ({
              accountId: account.id,
              accountAlias: account.accountAlias,
              brokerAccountNo: account.brokerAccountNo,
              externalAccountId: account.externalAccountId,
              credentialStatus: account.apiCredential?.status ?? "INACTIVE",
              lastUsedAt: account.apiCredential?.lastUsedAt ?? null,
              updatedAt: account.apiCredential?.updatedAt ?? null
            }))
        };
      });
  }

  async saveNamuhCredentialProfile(userId: string, body: NamuhCredentialInput) {
    const loginId = body.loginId?.trim();
    const loginPassword = body.loginPassword?.trim();
    const certificatePassword = body.certificatePassword?.trim();
    const accountPassword = body.accountPassword?.trim();
    if (!loginId) {
      throw new BadRequestException("나무 ID를 입력하세요.");
    }

    const existing = body.connectionId
      ? await this.prisma.brokerConnection.findFirst({
          where: { id: body.connectionId, userId, broker: "NAMUH" },
          include: { credential: true }
        })
      : null;
    if (body.connectionId && !existing) {
      throw new BadRequestException("수정할 나무 WMCA 연결 정보를 찾을 수 없습니다.");
    }

    const existingSecret = existing?.credential?.encryptedSecret ? readNamuhSecret(existing.credential.encryptedSecret) : {};
    const secret = {
      loginPassword: loginPassword || existingSecret.loginPassword,
      certificatePassword: certificatePassword || existingSecret.certificatePassword,
      accountPassword: accountPassword || existingSecret.accountPassword
    };
    if (!secret.loginPassword || !secret.certificatePassword || !secret.accountPassword) {
      throw new BadRequestException("새 나무 연결에는 ID 비밀번호, 인증서 비밀번호, 계좌 비밀번호가 모두 필요합니다.");
    }

    const existingMetadata = readMetadata(existing?.credential?.metadata);
    const profileCount = await this.prisma.brokerConnection.count({ where: { userId, broker: "NAMUH" } });
    const label = body.label?.trim() || existingMetadata.label || `나무 계정 ${profileCount + 1}`;
    const environment = body.environment === "MOCK" ? "MOCK" : "REAL";
    const certificateMode = body.certificateMode === "CLOUD" ? "CLOUD" : "PC";
    const connection = existing
      ? await this.prisma.brokerConnection.update({
          where: { id: existing.id },
          data: {
            brokerType: "NAMUH_WMCA",
            connectionType: "API",
            status: existing.status
          }
        })
      : await this.prisma.brokerConnection.create({
          data: {
            userId,
            broker: "NAMUH",
            brokerType: "NAMUH_WMCA",
            connectionType: "API",
            status: "INACTIVE"
          }
        });

    await this.prisma.brokerCredential.upsert({
      where: { connectionId: connection.id },
      create: {
        connectionId: connection.id,
        clientId: loginId,
        encryptedSecret: encryptCredentialSecret(JSON.stringify(secret)),
        metadata: namuhCredentialMetadata({
          label,
          environment,
          certificateMode,
          passwordPreview: previewCredentialSecret(secret.loginPassword),
          certificatePasswordPreview: previewCredentialSecret(secret.certificatePassword),
          accountPasswordPreview: previewCredentialSecret(secret.accountPassword),
          errorMessage: null
        })
      },
      update: {
        clientId: loginId,
        encryptedSecret: encryptCredentialSecret(JSON.stringify(secret)),
        metadata: namuhCredentialMetadata({
          label,
          environment,
          certificateMode,
          passwordPreview: previewCredentialSecret(secret.loginPassword),
          certificatePasswordPreview: previewCredentialSecret(secret.certificatePassword),
          accountPasswordPreview: previewCredentialSecret(secret.accountPassword),
          errorMessage: null
        })
      }
    });

    return this.listNamuhCredentials(userId);
  }

  async deleteNamuhCredentialProfile(userId: string, connectionId: string) {
    const connection = await this.prisma.brokerConnection.findFirst({
      where: { id: connectionId, userId, broker: "NAMUH" }
    });
    if (!connection) {
      throw new BadRequestException("삭제할 나무 WMCA 연결 정보를 찾을 수 없습니다.");
    }

    const accountCredentials = await this.prisma.accountApiCredential.findMany({
      where: { userId, broker: "NAMUH" }
    });
    const linkedAccountIds = accountCredentials
      .filter((credential) => readMetadata(credential.metadata).connectionId === connectionId)
      .map((credential) => credential.accountId);

    if (linkedAccountIds.length > 0) {
      await this.prisma.accountApiCredential.deleteMany({ where: { accountId: { in: linkedAccountIds } } });
    }

    await this.prisma.brokerConnection.delete({ where: { id: connection.id } });
    return this.listNamuhCredentials(userId);
  }

  private async ensureTossConnection(userId: string) {
    const existing = await this.prisma.brokerConnection.findFirst({ where: { userId, broker: "TOSS" } });
    await this.prisma.brokerConnection.upsert({
      where: { id: existing?.id ?? crypto.randomUUID() },
      create: {
        userId,
        broker: "TOSS",
        connectionType: "API",
        status: "ACTIVE"
      },
      update: {
        connectionType: "API",
        status: "ACTIVE"
      }
    });
  }
}

function emptyKiwoomCredential() {
  return {
    appKey: null,
    secretPreview: null,
    status: "INACTIVE",
    useMock: false,
    baseUrl: kiwoomBaseUrl(false),
    source: "NONE",
    updatedAt: null
  };
}

function kiwoomCredentialMetadata(useMock: boolean, secretPreview: string | null, label: string) {
  return {
    provider: "kiwoom-rest-api",
    credentialType: "kiwoom-app",
    storage: "broker_connection",
    label,
    useMock,
    baseUrl: kiwoomBaseUrl(useMock),
    secretPreview,
    updatedAt: new Date().toISOString()
  };
}

function kiwoomBaseUrl(useMock: boolean) {
  return useMock
    ? process.env.KIWOOM_MOCK_API_BASE_URL ?? "https://mockapi.kiwoom.com"
    : process.env.KIWOOM_API_BASE_URL ?? "https://api.kiwoom.com";
}

function namuhCredentialMetadata({
  label,
  environment,
  certificateMode,
  passwordPreview,
  certificatePasswordPreview,
  accountPasswordPreview,
  errorMessage
}: {
  label: string;
  environment: "REAL" | "MOCK";
  certificateMode: "PC" | "CLOUD";
  passwordPreview: string;
  certificatePasswordPreview: string;
  accountPasswordPreview: string;
  errorMessage: string | null;
}) {
  return {
    provider: "namuh-wmca-openapi",
    credentialType: "namuh-wmca-login",
    storage: "broker_connection",
    label,
    environment,
    certificateMode,
    mediaType: "T",
    userType: "W",
    bridgeUrl: process.env.NAMUH_WMCA_BRIDGE_URL ?? null,
    passwordPreview,
    certificatePasswordPreview,
    accountPasswordPreview,
    errorMessage,
    documentProfile: {
      sdk: "WMCA 32bit regular DLL",
      auth: "wmcaConnect 또는 wmcaConnectCert",
      balanceTrCode: "c8201",
      domesticQuoteTrCode: "IVWUTKMST04",
      realtimeTradeCode: "mc"
    },
    updatedAt: new Date().toISOString()
  };
}

function readNamuhSecret(encryptedSecret: string) {
  try {
    const value = JSON.parse(decryptCredentialSecret(encryptedSecret));
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as {
      loginPassword?: string;
      certificatePassword?: string;
      accountPassword?: string;
    };
  } catch {
    return {};
  }
}

function readMetadata(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}
