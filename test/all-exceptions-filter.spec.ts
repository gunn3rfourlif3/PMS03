import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/observability/all-exceptions.filter';

/**
 * This filter builds the error envelope from scratch, so any field it does not
 * explicitly copy is dropped on the way out. That cost a day once: the API
 * attached a `code` to a 403, the filter discarded it, and the client — which
 * branched on that code to offer a recovery action — silently never fired.
 *
 * These cases pin the envelope's contract so the next field someone adds to an
 * exception either survives or fails here rather than in production.
 */
function run(exception: unknown) {
  let status = 0;
  let body: any = null;
  const res = { status: (s: number) => { status = s; return res; }, json: (b: any) => { body = b; return res; } };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'POST', url: '/api/auth/otp/verify', id: 'req-1', headers: {}, body: {} }),
    }),
  };
  new AllExceptionsFilter(undefined).catch(exception, host as any);
  return { status, body };
}

describe('AllExceptionsFilter', () => {
  it('forwards a code the thrower supplied', () => {
    const { status, body } = run(new ForbiddenException({
      statusCode: 403, code: 'LEASE_SIGNATURE_PENDING', message: 'Please sign your lease agreement first.',
    }));
    expect(status).toBe(403);
    expect(body.code).toBe('LEASE_SIGNATURE_PENDING');
    expect(body.message).toBe('Please sign your lease agreement first.');
  });

  it('omits code entirely when none was supplied', () => {
    const { body } = run(new NotFoundException('Partner not found'));
    // Absent, not null or empty string — a client checking `body.code` should
    // get undefined rather than a falsy value it has to special-case.
    expect('code' in body).toBe(false);
    expect(body.message).toBe('Partner not found');
  });

  it('still reports 500 with a message for a non-HttpException', () => {
    const { status, body } = run(new Error('kaboom'));
    expect(status).toBe(500);
    expect(body.message).toBe('kaboom');
    expect(body.requestId).toBeTruthy();
  });

  it('keeps the rest of the envelope intact', () => {
    const { body } = run(new ForbiddenException({ code: 'X', message: 'nope' }));
    expect(body).toMatchObject({ statusCode: 403, error: 'FORBIDDEN', path: '/api/auth/otp/verify' });
    expect(body.timestamp).toBeTruthy();
  });
});
