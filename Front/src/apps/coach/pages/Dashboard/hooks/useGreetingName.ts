import { useUser } from "../../../../../shared/context/UserContext";

type GreetingUser = {
  username?: string;
  firstName?: string;
};

export function resolveGreetingName(user: GreetingUser | null | undefined): string | null {
  const firstName = user?.firstName?.trim();
  if (firstName) return firstName;

  const username = user?.username?.trim();
  const usernameLooksLikeEmail = username?.includes("@") ?? false;
  if (username && !usernameLooksLikeEmail) return username;

  return null;
}

export function useGreetingName(): string | null {
  const { user } = useUser();
  return resolveGreetingName(user);
}
