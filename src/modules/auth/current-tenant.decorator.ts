import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Injects { userId, vendorId, roles } resolved from the JWT into a handler. */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);
