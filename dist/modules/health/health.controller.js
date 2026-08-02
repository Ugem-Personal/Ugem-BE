import { sendError, sendSuccess } from "../../common/utils/api-response.js";
import { asyncHandler } from "../../common/utils/async-handler.js";
import { checkDatabaseReadiness, isShuttingDown, } from "./health.service.js";
export const getLiveness = (_req, res) => {
    return sendSuccess(res, {
        message: "UGem API is alive",
        data: {
            status: "UP",
            uptimeSeconds: Math.floor(process.uptime()),
        },
    });
};
export const getReadiness = asyncHandler(async (_req, res) => {
    const readiness = await checkDatabaseReadiness();
    if (!readiness.ready || isShuttingDown()) {
        return sendError(res, {
            statusCode: 503,
            message: "UGem API is not ready",
            errors: {
                status: "DOWN",
                database: readiness.database,
                shuttingDown: isShuttingDown(),
            },
        });
    }
    return sendSuccess(res, {
        message: "UGem API is ready",
        data: {
            status: "UP",
            database: readiness.database,
        },
    });
});
