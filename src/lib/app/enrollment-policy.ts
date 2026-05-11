export type EnrollmentPolicy = {
	semester: "GANJIL" | "GENAP";
	academicYear: string;
	requestsOpen: boolean;
};

export const DEFAULT_ENROLLMENT_POLICY: EnrollmentPolicy = {
	semester: "GANJIL",
	academicYear: "2025/2026",
	requestsOpen: false,
};

export function isEnrollmentRequestsOpen(value: unknown) {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value === 1;
	if (typeof value === "string") {
		return ["1", "true", "on", "yes", "open"].includes(
			value.trim().toLowerCase(),
		);
	}
	if (value instanceof Uint8Array) {
		return value.length > 0 && value[0] === 1;
	}
	return false;
}

export function normalizeEnrollmentPolicy(input: {
	semester?: unknown;
	academicYear?: unknown;
	requestsOpen?: unknown;
}): EnrollmentPolicy {
	const academicYear =
		typeof input.academicYear === "string" ? input.academicYear.trim() : "";

	return {
		semester:
			input.semester === "GENAP" ? "GENAP" : DEFAULT_ENROLLMENT_POLICY.semester,
		academicYear: academicYear || DEFAULT_ENROLLMENT_POLICY.academicYear,
		requestsOpen: isEnrollmentRequestsOpen(input.requestsOpen),
	};
}

export function createDefaultEnrollmentPolicy() {
	return { ...DEFAULT_ENROLLMENT_POLICY };
}
