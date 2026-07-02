import { ApplicationStatus } from './application.entity';

/** Allowed application status transitions. Terminal states have no exits. */
const ALLOWED: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted: ['screening', 'rejected', 'withdrawn'],
  screening: ['approved', 'rejected', 'withdrawn'],
  approved: [],
  rejected: [],
  withdrawn: [],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED[from].includes(to);
}
