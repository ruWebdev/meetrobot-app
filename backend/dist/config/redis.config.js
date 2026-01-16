"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
});
