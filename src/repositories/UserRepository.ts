import { SupabaseService } from '../services/SupabaseService';

export interface User {
  userId: string;
  username: string;
  passwordHash?: string;
  salt?: string;
  role: 'Admin' | 'Staff';
  createdAt: string;
}

const LOCAL_KEY = 'kvu_users';
const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH = 256;
const HASH_ALGORITHM = 'SHA-256';

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH
  );
  return Array.from(new Uint8Array(derivedBits), b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return false;
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

function makeDefaultAdmin(): User {
  const salt = generateSalt();
  return {
    userId: 'admin',
    username: 'Administrator',
    passwordHash: '',
    salt,
    role: 'Admin',
    createdAt: new Date().toISOString(),
  };
}

function getCached(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [makeDefaultAdmin()];
    const arr = JSON.parse(raw) as User[];
    if (!Array.isArray(arr) || arr.length === 0) return [makeDefaultAdmin()];
    return arr;
  } catch {
    return [makeDefaultAdmin()];
  }
}

function setCached(users: User[]): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(users));
}

export const UserRepository = {
  getUsers(): User[] {
    return getCached();
  },

  async refreshFromCloud(): Promise<User[]> {
    const cloudUsers = await SupabaseService.pullAllUsers();
    if (!cloudUsers || cloudUsers.length === 0) {
      if (navigator.onLine && cloudUsers !== null) {
        const admin = makeDefaultAdmin();
        admin.passwordHash = await hashPassword('kvu', admin.salt || '');
        await SupabaseService.upsertUser(admin);
        setCached([admin]);
        return [admin];
      }
      return getCached();
    }

    const migrated = await Promise.all(cloudUsers.map(async (u: any) => {
      if (!u.salt) {
        const newSalt = generateSalt();
        return { ...u, salt: newSalt, passwordHash: '' };
      }
      return u;
    }));

    setCached(migrated);
    return migrated;
  },

  async createUser(
    userId: string,
    username: string,
    passwordText: string,
    role: 'Admin' | 'Staff'
  ): Promise<{ user: User; plainPassword: string }> {
    const cleanId = userId.trim().toLowerCase();
    const cleanPass = passwordText.trim();

    if (!cleanId || !username.trim() || !cleanPass) {
      throw new Error('All fields are required!');
    }

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(cleanPass)) {
      throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).');
    }

    const cached = getCached();
    if (cached.some(u => u.userId === cleanId)) {
      throw new Error(`User ID "${cleanId}" already exists!`);
    }

    const salt = generateSalt();
    const passwordHash = await hashPassword(cleanPass, salt);

    const newUser: User = {
      userId: cleanId,
      username: username.trim(),
      passwordHash,
      salt,
      role,
      createdAt: new Date().toISOString(),
    };

    const saved = await SupabaseService.upsertUser(newUser);
    if (!saved && navigator.onLine) {
      throw new Error('Failed to save to Supabase. Please check your internet connection.');
    }

    const updated = [...cached, newUser];
    setCached(updated);
    console.log('[UserRepository] User created & saved:', cleanId, '| Total users:', updated.length);

    return { user: newUser, plainPassword: cleanPass };
  },

  async updateUser(
    userId: string,
    updates: Partial<Pick<User, 'username' | 'role'>> & { passwordText?: string }
  ): Promise<void> {
    const cleanId = userId.trim().toLowerCase();
    let cached = getCached();

    const updated = await Promise.all(cached.map(async (u) => {
      if (u.userId !== cleanId) return u;
      const merged = { ...u, ...updates };
      if (updates.passwordText) {
        const cleanPass = updates.passwordText.trim();
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(cleanPass)) {
          throw new Error('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).');
        }
        const newSalt = generateSalt();
        merged.salt = newSalt;
        merged.passwordHash = await hashPassword(cleanPass, newSalt);
      }
      return merged;
    }));

    setCached(updated);

    const toSync = updated.find(u => u.userId === cleanId);
    if (toSync) {
      await SupabaseService.upsertUser(toSync);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    const cleanId = userId.trim().toLowerCase();
    const cached = getCached();
    const filtered = cached.filter(u => u.userId !== cleanId);
    setCached(filtered);
    await SupabaseService.deleteUser(cleanId);
  },

  async verifyCredentials(userId: string, password: string): Promise<User | null> {
    const cleanId = userId.trim().toLowerCase();
    const cleanPass = password.trim();

    let users: User[];
    try {
      users = await UserRepository.refreshFromCloud();
    } catch {
      users = getCached();
    }

    const user = users.find(u => u.userId === cleanId);
    if (!user) return null;

    if (typeof crypto === 'undefined' || !crypto.subtle) {
      throw new Error('Secure context (HTTPS or localhost) is required to login.');
    }

    // Lazy initialization of passwordHash for default offline admin
    if (user.userId === 'admin' && !user.passwordHash && cleanId === 'admin') {
      user.passwordHash = await hashPassword('kvu', user.salt || '');
      const cached = getCached();
      const idx = cached.findIndex(u => u.userId === 'admin');
      if (idx !== -1) {
        cached[idx] = user;
        setCached(cached);
      }
    }

    const isValid = await verifyPassword(cleanPass, user.salt || '', user.passwordHash || '');
    return isValid ? user : null;
  },
};