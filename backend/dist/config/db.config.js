"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/meetrobot',
});
