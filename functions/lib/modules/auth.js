"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResetPasswordLink = void 0;
const https_1 = require("firebase-functions/v2/https");
const auth_1 = require("firebase-admin/auth");
const zod_1 = require("zod");
const rbac_js_1 = require("../lib/rbac.js");
exports.createResetPasswordLink = (0, https_1.onCall)(async (request) => {
    (0, rbac_js_1.requireAuth)(request);
    (0, rbac_js_1.requireRole)(request, ["admin"]);
    const input = zod_1.z.object({ email: zod_1.z.string().email() }).parse(request.data);
    const link = await (0, auth_1.getAuth)().generatePasswordResetLink(input.email);
    return { link };
});
