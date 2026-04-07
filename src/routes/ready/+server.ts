import { json } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';

export const GET = async () => {
	try {
		await getPool().query('SELECT 1');
		return json({ status: 'ready' });
	} catch {
		return json({ status: 'not_ready' }, { status: 503 });
	}
};
