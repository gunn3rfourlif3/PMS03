import {
  CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DeploymentCapabilities, deploymentCapabilities, deploymentProfile, DEPLOYMENT_LABELS,
} from './deployment-profile';

export const CAPABILITY_KEY = 'requiredCapability';

/**
 * Mark an endpoint as served only where the deployment mode allows it.
 *
 *   @RequiresCapability('publicListings')
 *
 * Used for the routes an OUTSIDER reaches, which are the ones option A seals.
 * Staff routes carry no capability and are served in every mode.
 */
export const RequiresCapability = (cap: keyof DeploymentCapabilities) =>
  SetMetadata(CAPABILITY_KEY, cap);

/**
 * Refuses, rather than hiding. A 404 would be kinder to look at and worse to
 * demo: the client's question is "is it actually off, or just not on the menu",
 * and a 403 that names the mode answers it.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<keyof DeploymentCapabilities>(
      CAPABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;
    if (deploymentCapabilities()[required]) return true;

    const profile = deploymentProfile();
    throw new ForbiddenException({
      statusCode: 403,
      code: 'DEPLOYMENT_PROFILE_FORBIDS_CAPABILITY',
      capability: required,
      message: `This system is installed on-site for staff use only (${DEPLOYMENT_LABELS[profile]}), so this is not served here.`,
    });
  }
}
