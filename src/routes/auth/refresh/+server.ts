import { json } from '@sveltejs/kit';
import { refreshSession } from '$lib/server/auth';

export async function POST() {
	const session = await refreshSession();
	if (!session) {
		return json({ message: 'Refresh token tidak valid' }, { status: 401 });
	}

	return json({
		accessToken: session.accessToken,
		user: session.user
	});
}
