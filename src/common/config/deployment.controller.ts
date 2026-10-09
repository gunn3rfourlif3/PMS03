import { Controller, Get } from '@nestjs/common';
import {
  deploymentProfile, deploymentCapabilities, isOnSite, DEPLOYMENT_LABELS,
} from './deployment-profile';

/**
 * The installation's deployment mode, for the front end.
 *
 * WHY THIS EXISTS. The back office previously read `DEPLOYMENT_PROFILE` from
 * its own environment, which meant two copies of one fact: set them differently
 * and the menu offers something the API refuses. One compose variable fed both,
 * but nothing enforced it. Now the API — which is the thing that actually
 * enforces the mode — is also the thing that reports it, so they cannot
 * disagree.
 *
 * UNAUTHENTICATED, on purpose. The sign-in page needs it before anyone has a
 * token, and the mode is not a secret: the client chose it, and a sealed
 * installation announcing that it is sealed tells an outsider nothing they could
 * not learn by being refused.
 */
@Controller('deployment')
export class DeploymentController {
  @Get()
  get() {
    const profile = deploymentProfile();
    return {
      profile,
      label: DEPLOYMENT_LABELS[profile],
      onSite: isOnSite(profile),
      capabilities: deploymentCapabilities(),
    };
  }
}
