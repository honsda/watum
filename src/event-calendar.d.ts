declare module "@event-calendar/core" {
	import type { Component } from "svelte";

	export const Calendar: Component<{ plugins?: unknown[]; options?: unknown }>;
	export const TimeGrid: unknown;
	export const Interaction: unknown;
}

declare module "@event-calendar/core/index.css";
