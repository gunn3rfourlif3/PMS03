/** Claims embedded in the access token. */
export interface JwtPayload {
  sub: string;              // userId
  vendorId: string | null;  // active vendor context
  roles: string[];          // roles within that vendor (or 'partner' / 'platform_admin')
  partnerId?: string | null; // set when the token operates in a partner context
  jti?: string;             // session id — checked against the Redis registry for revocation
  /** Present only during platform-admin impersonation of an agency. */
  act?: { id: string; email: string; ev: string; agency: string };
}
