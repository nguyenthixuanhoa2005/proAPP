import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_PORT = '3000';
//Tự lấy IP LAN của máy chạy Expo Go để kết nối đến backend khi đang ở chế độ development, tránh lỗi kết nối đến localhost hoặc IP không đúng
const resolveExpoHost = () => {
	const hostUri =
		Constants.expoConfig?.hostUri ||
		Constants.expoGoConfig?.debuggerHost ||
		Constants.manifest2?.extra?.expoClient?.hostUri ||
		'';

	if (!hostUri) {
		return '';
	}

	return String(hostUri).split(':')[0];
};

const configBaseUrl = String(Constants.expoConfig?.extra?.apiBaseUrl || '').trim();
const resolvedExpoHost = resolveExpoHost();

export const API_BASE_URL =
	configBaseUrl ||
	(resolvedExpoHost ? `http://${resolvedExpoHost}:${API_PORT}` : `http://localhost:${API_PORT}`);

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

let memoryAccessToken = null;
let memoryRefreshToken = null;
let refreshInFlight = null;

const readStoredTokens = async () => {
	if (memoryAccessToken && memoryRefreshToken) {
		return { accessToken: memoryAccessToken, refreshToken: memoryRefreshToken };
	}

	const [accessToken, refreshToken] = await Promise.all([
		AsyncStorage.getItem(ACCESS_TOKEN_KEY),
		AsyncStorage.getItem(REFRESH_TOKEN_KEY),
	]);

	memoryAccessToken = accessToken;
	memoryRefreshToken = refreshToken;
	return { accessToken, refreshToken };
};

export const setAuthTokens = async ({ accessToken, refreshToken }) => {
	memoryAccessToken = accessToken || null;
	memoryRefreshToken = refreshToken || null;

	const tasks = [];
	if (accessToken) {
		tasks.push(AsyncStorage.setItem(ACCESS_TOKEN_KEY, accessToken));
	} else {
		tasks.push(AsyncStorage.removeItem(ACCESS_TOKEN_KEY));
	}

	if (refreshToken) {
		tasks.push(AsyncStorage.setItem(REFRESH_TOKEN_KEY, refreshToken));
	} else {
		tasks.push(AsyncStorage.removeItem(REFRESH_TOKEN_KEY));
	}

	await Promise.all(tasks);
};

export const clearAuthTokens = async () => {
	memoryAccessToken = null;
	memoryRefreshToken = null;
	await Promise.all([
		AsyncStorage.removeItem(ACCESS_TOKEN_KEY),
		AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
	]);
};

export const getAuthTokens = async () => readStoredTokens();

const parseResponse = async (response) => {
	const text = await response.text();
	const data = text ? JSON.parse(text) : null;

	if (!response.ok) {
		const message = data?.message || data?.error || 'Request failed';
		const error = new Error(message);
		error.status = response.status;
		error.data = data;
		throw error;
	}

	return data;
};

const withNetworkHint = (error) => {
	const message = String(error?.message || '').toLowerCase();
	if (message.includes('network request failed') || message.includes('failed to fetch')) {
		const wrapped = new Error(`Khong ket noi duoc API (${API_BASE_URL}). Kiem tra backend, IP LAN va cung mang Wi-Fi.`);
		wrapped.cause = error;
		return wrapped;
	}

	return error;
};

const doRefreshToken = async () => {
	const { refreshToken } = await readStoredTokens();
	if (!refreshToken) {
		throw new Error('Missing refresh token');
	}

	let response;
	try {
		response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ refreshToken }),
		});
	} catch (error) {
		throw withNetworkHint(error);
	}

	const data = await parseResponse(response);
	await setAuthTokens({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
	});

	return data;
};

const refreshIfNeeded = async () => {
	if (!refreshInFlight) {
		refreshInFlight = doRefreshToken()
			.catch(async (error) => {
				await clearAuthTokens();
				throw error;
			})
			.finally(() => {
				refreshInFlight = null;
			});
	}

	return refreshInFlight;
};

export const request = async (path, options = {}) => {
	let response;
	try {
		response = await fetch(`${API_BASE_URL}${path}`, {
			...options,
			headers: {
				Accept: 'application/json',
				...(options.headers || {}),
			},
		});
	} catch (error) {
		throw withNetworkHint(error);
	}

	return parseResponse(response);
};

export const authRequest = async (path, options = {}) => {
	const { accessToken } = await readStoredTokens();

	const doCall = async (token) => {
		const headers = {
			Accept: 'application/json',
			...(options.headers || {}),
		};

		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}

		let response;
		try {
			response = await fetch(`${API_BASE_URL}${path}`, {
				...options,
				headers,
			});
		} catch (error) {
			throw withNetworkHint(error);
		}

		return response;
	};

	let response = await doCall(accessToken);
	if (response.status !== 401) {
		return parseResponse(response);
	}

	const refreshed = await refreshIfNeeded();
	response = await doCall(refreshed.accessToken);
	return parseResponse(response);
};
