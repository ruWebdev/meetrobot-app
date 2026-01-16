export interface FlowHandler {
    onEnter(ctx: any): Promise<void>;
    onUpdate(ctx: any): Promise<void>;
    onExit(ctx: any): Promise<void>;
}
