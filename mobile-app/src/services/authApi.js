import { clearAuthTokens, getAuthTokens, request, setAuthTokens } from './client';

const defaultHeaders = {
	'Content-Type': 'application/json',
};

export const loginWithEmail = async ({ email, password }) => {
	const data = await request('/api/auth/login', {
		method: 'POST',
		headers: defaultHeaders,
		body: JSON.stringify({ email, password }),
	});

	await setAuthTokens({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
	});

	return data;
};

export const loginWithGoogle = async ({ idToken }) => {
	const data = await request('/api/auth/social/google', {
		method: 'POST',
		headers: defaultHeaders,
		body: JSON.stringify({ idToken }),
	});

	await setAuthTokens({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken,
	});

	return data;
};

export const logout = async () => {
	const { refreshToken } = await getAuthTokens();
	try {
		await request('/api/auth/logout', {
			method: 'POST',
			headers: defaultHeaders,
			body: JSON.stringify({ refreshToken }),
		});
	} finally {
		await clearAuthTokens();
	}
};
