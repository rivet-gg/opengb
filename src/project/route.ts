import { RouteConfig } from "../config/module.ts";

export interface Route {
	path: string;
	name: string;
	config: RouteConfig;
}
