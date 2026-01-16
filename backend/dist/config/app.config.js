"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = () => ({
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
});
