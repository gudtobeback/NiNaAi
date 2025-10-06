import { User } from '../types';
import * as db from './dbService';

const SESSION_STORAGE_KEY = 'netops_ai_user';

const DUMMY_USERS = [
    { username: 'admin', password: 'adminpass' },
    { username: 'neteng', password: 'netengpass' },
    { username: 'operator', password: 'oppass' },
    { username: 'guest', password: 'guestpass' },
];

// --- Public Functions ---

export const login = (user: User) => {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
};

export const logout = () => {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
};

export const getCurrentUser = (): User | null => {
  const userJson = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (userJson) {
    try {
      return JSON.parse(userJson);
    } catch (e) {
      console.error('Failed to parse user from session storage', e);
      return null;
    }
  }
  return null;
};

export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
    // In a real app, passwords should be hashed and compared.
    // For this demo, we are storing and comparing plain text.
    await seedDummyUsers(); // Ensure users exist

    const userRecord = await db.getUserByUsername(username);

    // @ts-ignore - We are retrieving the full record including password here for demo purposes
    if (userRecord && userRecord.password === password) {
        return {
            id: userRecord.id,
            username: userRecord.username,
        };
    }
    return null;
};


// --- Private Functions ---

let usersSeeded = false;
const seedDummyUsers = async () => {
    if (usersSeeded) return;

    try {
        for (const user of DUMMY_USERS) {
            const existing = await db.getUserByUsername(user.username);
            if (!existing) {
                await db.addUser(user);
                console.log(`Added dummy user: ${user.username}`);
            }
        }
        usersSeeded = true;
    } catch (error) {
        console.error("Error seeding dummy users:", error);
    }
};
