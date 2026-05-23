import { error } from "@sveltejs/kit";
import { env } from "$env/dynamic/private";

export function load() {
	if (env.ENABLE_INTERNAL_TEST_ROUTE !== "true") {
		throw error(404, "Not found");
	}
}
