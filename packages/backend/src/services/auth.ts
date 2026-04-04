/**
 * Auth Service — login, user lookup
 *
 * All password verification happens here. Routes stay thin.
 */

import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users } from '../db/schema';
import type { UserResponse } from '@finplan/shared';

export async function login(username: string, password: string): Promise<UserResponse> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  // Constant-time failure — don't leak whether username exists
  if (!user) {
    await bcrypt.hash(password, 12); // timing equalisation
    throw new Error('INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}

export async function getUserById(id: string): Promise<UserResponse | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}
