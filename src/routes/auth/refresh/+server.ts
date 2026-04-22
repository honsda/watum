import { json } from '@sveltejs/kit';
import { refreshSession } from '$lib/server/auth';

export async function POST() {
	const session = await refreshSession();
	if (!session) {
		return new Response(null, { status: 204 });
	}

	return json({
		accessToken: session.accessToken,
		user: session.user
	});
}
