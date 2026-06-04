import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth.service";
import type { AuthenticatedUser } from "../oauth.types";

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.authService.getCurrentUser(request);
    return true;
  }
}
