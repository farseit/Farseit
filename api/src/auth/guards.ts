import { ExecutionContext, ForbiddenException, Injectable, createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

export function getRequest(ctx: ExecutionContext) {
  return ctx.getType<string>() === 'http'
    ? ctx.switchToHttp().getRequest()
    : GqlExecutionContext.create(ctx).getContext().req;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  getRequest(ctx: ExecutionContext) {
    return getRequest(ctx);
  }
}

/** Lets guests through; req.user is null when not logged in. */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  getRequest(ctx: ExecutionContext) {
    return getRequest(ctx);
  }
  handleRequest(_err: any, user: any) {
    return user || null;
  }
}

@Injectable()
export class AdminGuard extends JwtAuthGuard {
  handleRequest(err: any, user: any, info: any, ctx: ExecutionContext, status?: any) {
    const u = super.handleRequest(err, user, info, ctx, status);
    if (u.role !== 'ADMIN') throw new ForbiddenException('Admin access only');
    return u;
  }
}

/** Owner (ADMIN) ba team member (AGENT), duijon-i inbox-e dhukte pare */
@Injectable()
export class StaffGuard extends JwtAuthGuard {
  handleRequest(err: any, user: any, info: any, ctx: ExecutionContext, status?: any) {
    const u = super.handleRequest(err, user, info, ctx, status);
    if (u.role !== 'ADMIN' && u.role !== 'AGENT') throw new ForbiddenException('Staff access only');
    return u;
  }
}

export const CurrentUser = createParamDecorator((_d: unknown, ctx: ExecutionContext) => getRequest(ctx).user);
