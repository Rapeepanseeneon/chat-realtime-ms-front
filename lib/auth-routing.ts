export type OnboardingUser = { onboardingCompleted: boolean };

export const getAuthenticatedDestination = (user: OnboardingUser) =>
  user.onboardingCompleted ? "/chat" : "/onboarding";
