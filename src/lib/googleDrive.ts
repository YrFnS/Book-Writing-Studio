import { Book, UserPreferences } from '../types';

// Google Drive access uses Google Identity Services directly, so the only
// thing a deployment needs is an OAuth Client ID the user creates in their own
// Google Cloud project. No Firebase project, no API key, no client secret.

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

let gisLoader: Promise<void> | null = null;

const loadGis = (): Promise<void> => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoader) return gisLoader;

  gisLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoader = null;
      reject(new Error('Could not load Google sign-in. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return gisLoader;
};

let cachedAccessToken: string | null = null;

export const getCachedToken = (): string | null => cachedAccessToken;

export const setCachedToken = (token: string | null) => {
  cachedAccessToken = token;
};

/** The origin the user must whitelist on their own OAuth client. */
export const getRequiredOrigin = (): string => window.location.origin;

/**
 * Google returns an opaque "invalid_client"-style failure when the Client ID
 * is malformed, so catch the obvious shape problem before opening a popup.
 */
export const isLikelyClientId = (value: string): boolean =>
  /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value.trim());

const requestToken = (clientId: string, prompt: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId.trim(),
      scope: `${DRIVE_FILE_SCOPE} ${EMAIL_SCOPE}`,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token);
        else reject(new Error(response.error_description || response.error || 'Google did not return access.'));
      },
      error_callback: (error) => {
        reject(new Error(error.message || error.type || 'Google sign-in was cancelled.'));
      },
    });
    client.requestAccessToken({ prompt });
  });

const fetchUserEmail = async (token: string): Promise<string> => {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.email || '';
  } catch {
    return '';
  }
};

/**
 * Opens Google's account chooser and returns a Drive access token.
 * Pass silent=true to renew an expired token without a popup, which only
 * works once the user has already granted consent on this browser.
 */
export const signInWithGoogleDrive = async (
  clientId: string,
  silent = false
): Promise<{ user: { email: string }; accessToken: string }> => {
  if (!clientId?.trim()) {
    throw new Error('Add your Google Client ID first — see the setup steps below.');
  }
  if (!isLikelyClientId(clientId)) {
    throw new Error('That does not look like a Client ID. It should end in .apps.googleusercontent.com');
  }

  await loadGis();
  const accessToken = await requestToken(clientId, silent ? '' : 'consent');
  cachedAccessToken = accessToken;
  return { user: { email: await fetchUserEmail(accessToken) }, accessToken };
};

export const signOutGoogleDrive = async (): Promise<void> => {
  const token = cachedAccessToken;
  cachedAccessToken = null;
  if (!token) return;
  try {
    await loadGis();
    window.google?.accounts.oauth2.revoke(token);
  } catch {
    // Dropping the cached token is enough; revocation is a courtesy.
  }
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
