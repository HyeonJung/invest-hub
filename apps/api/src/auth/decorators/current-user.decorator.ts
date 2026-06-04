import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest } from "../guards/auth.guard";

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  return request.user;
});
