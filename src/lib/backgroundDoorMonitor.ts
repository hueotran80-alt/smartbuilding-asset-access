import { registerPlugin } from "@capacitor/core";
export interface BackgroundDoorMonitorPlugin{requestPermissions():Promise<void>;start(options:{supabaseUrl:string;supabaseAnonKey:string;accessToken:string;refreshToken:string}):Promise<void>;stop():Promise<void>;}
export const BackgroundDoorMonitor=registerPlugin<BackgroundDoorMonitorPlugin>("BackgroundDoorMonitor");