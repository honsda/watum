// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				email: string;
				role: 'ADMIN' | 'STUDENT' | 'LECTURER';
				studentId: string | null;
				lecturerId: string | null;
				student: { id: string; name: string } | null;
				lecturer: { id: string; name: string } | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
