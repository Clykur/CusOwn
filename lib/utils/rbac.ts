import { userService } from '@/services/user.service';

export async function isAdmin(userId: string): Promise<boolean> {
  const profile = await userService.getUserProfile(userId);
  return profile?.user_type === 'admin';
}

export async function isOwner(userId: string): Promise<boolean> {
  const profile = await userService.getUserProfile(userId);
  return profile?.user_type === 'owner' || profile?.user_type === 'both';
}

export async function isCustomer(userId: string): Promise<boolean> {
  const profile = await userService.getUserProfile(userId);
  return profile?.user_type === 'customer' || profile?.user_type === 'both';
}

export async function getUserRole(
  userId: string
): Promise<'admin' | 'owner' | 'customer' | 'both' | null> {
  const profile = await userService.getUserProfile(userId);
  return profile?.user_type || null;
}
