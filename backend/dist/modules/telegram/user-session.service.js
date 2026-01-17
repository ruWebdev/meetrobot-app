"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessionService = void 0;
const common_1 = require("@nestjs/common");
const redis_module_1 = require("../../infra/redis/redis.module");
let UserSessionService = class UserSessionService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    buildKey(params) {
        return `user_session:${params.telegramUserId}:${params.telegramChatId}`;
    }
    async getOrCreate(params) {
        const key = this.buildKey(params);
        const raw = await this.redis.get(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            return {
                ...parsed,
                updatedAt: new Date(parsed.updatedAt),
            };
        }
        const session = {
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
            activeFlowType: null,
            activeEntityId: null,
            eventDraft: null,
            eventDraftStep: null,
            updatedAt: new Date(),
        };
        await this.save(session);
        return session;
    }
    async save(session) {
        const key = this.buildKey({ telegramUserId: session.telegramUserId, telegramChatId: session.telegramChatId });
        const payload = {
            ...session,
            updatedAt: session.updatedAt.toISOString(),
        };
        await this.redis.set(key, JSON.stringify(payload));
    }
    async reset(params) {
        const session = {
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
            activeFlowType: null,
            activeEntityId: null,
            eventDraft: null,
            eventDraftStep: null,
            updatedAt: new Date(),
        };
        await this.save(session);
        return session;
    }
    async updateActiveFlow(params) {
        const session = await this.getOrCreate({
            telegramUserId: params.telegramUserId,
            telegramChatId: params.telegramChatId,
            workspaceId: params.workspaceId,
        });
        session.activeFlowType = params.activeFlowType;
        session.activeEntityId = params.activeEntityId;
        session.updatedAt = new Date();
        await this.save(session);
        return session;
    }
};
exports.UserSessionService = UserSessionService;
exports.UserSessionService = UserSessionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], UserSessionService);
