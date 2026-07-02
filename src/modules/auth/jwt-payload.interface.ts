/** Claims embedded in the access token. */
export interface JwtPayload {
  sub: string;              // userId
  vendorId: string | null;  // active vendor context
  roles: string[];          // roles within that vendor
}
