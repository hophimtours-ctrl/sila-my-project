"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const https_1 = require("firebase-functions/v2/https");
function requireAuth(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Authentication required");
    }
    return request.auth.uid;
}
function requireRole(request, roles) {
    const role = request.auth?.token?.role ?? "customer";
    if (!roles.includes(role)) {
        throw new https_1.HttpsError("permission-denied", "Insufficient permissions");
    }
    return role;
}
