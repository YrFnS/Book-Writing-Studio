import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Book, UserPreferences } from '../types';

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const provider = new GoogleAuthProvider();
provider.addScope(DRIVE_FILE_SCOPE);
provider.setCustomParameters({
  prompt: 'consent',
});

let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const getCachedToken = (): string | null => cachedAccessToken;

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

// Listen for auth state changes
export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

// Sign in with Google Popup
export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Failed to retrieve access token from Google sign in');
    }

    cachedAccessToken = token;
    return {
      user: result.user,
      accessToken: token,
    };
  } finally {
    isSigningIn = false;
  }
};

// Sign out
export const signOutGoogleDrive = async (): Promise<void> => {
  await signOut(auth);
  cachedAccessToken = null;
};

// --- Google Drive API Operations ---

const FOLDER_NAME = 'InkWeaver Studio';
const BACKUP_FILE_NAME = 'inkweaver_library.json';

// Helper to get or create app folder in user's Drive
export async function getOrCreateAppFolder(token: string): Promise<string> {
  // Search for existing folder
  const query = encodeURIComponent(`name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) {
    const errorData = await searchRes.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Failed to search Google Drive folders (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Folder doesn't exist, create it
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to create Google Drive folder (${createRes.status})`);
  }

  const folderData = await createRes.json();
  return folderData.id;
}

export interface DriveSyncPayload {
  version: number;
  appName: string;
  exportedAt: number;
  books: Book[];
  preferences?: UserPreferences;
  activeBookId?: string | null;
}

// Push/Write Library to Google Drive
export async function uploadLibraryToDrive(
  token: string,
  payload: DriveSyncPayload
): Promise<{ fileId: string; modifiedTime: string }> {
  const folderId = await getOrCreateAppFolder(token);

  // Search for existing file in the folder
  const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const searchData = await searchRes.json();
  const existingFile = searchData.files?.[0];

  const fileContent = JSON.stringify(payload, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    parents: existingFile ? undefined : [folderId],
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime';
  let method = 'POST';

  if (existingFile?.id) {
    uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=multipart&fields=id,modifiedTime`;
    method = 'PATCH';
  }

  const uploadRes = await fetch(uploadUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to sync library to Google Drive (${uploadRes.status})`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    modifiedTime: result.modifiedTime || new Date().toISOString(),
  };
}

// Read/Pull Library from Google Drive
export async function downloadLibraryFromDrive(
  token: string
): Promise<{ payload: DriveSyncPayload | null; modifiedTime?: string; fileId?: string }> {
  const folderId = await getOrCreateAppFolder(token);

  const query = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed = false`);
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime,size)`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to search for backup file on Google Drive');
  }

  const searchData = await searchRes.json();
  const file = searchData.files?.[0];

  if (!file?.id) {
    return { payload: null };
  }

  const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!downloadRes.ok) {
    throw new Error(`Failed to download library file from Google Drive (${downloadRes.status})`);
  }

  const payload: DriveSyncPayload = await downloadRes.json();
  return {
    payload,
    modifiedTime: file.modifiedTime,
    fileId: file.id,
  };
}
